import { assert, web3, artifacts } from "hardhat";
import { getBalances, increaseTime } from "./utils";

const truffleAssert = require('truffle-assertions');

describe("Lottery", () => {
    const toBN = web3.utils.toBN;

    const Lottery = artifacts.require("Lottery");

    const lotteryPeriodInSeconds = 120; // 3 minutes
    const timeAfterLotteryHasFinished = lotteryPeriodInSeconds * 2;
    const ticketCost = toBN(2).mul(toBN(1e18)); // 2 eth
    const lotteryTicketsLimit = 3; // 3 tickets
    
	let accounts: string[];
	let owner: string;
	let lotteryInstance: any;

	beforeEach(async () => {
		accounts = await web3.eth.getAccounts();
		owner = accounts[0];

		lotteryInstance = await Lottery.new(
			ticketCost, //_lotteryTicketPrice in wei
			lotteryPeriodInSeconds, // _lotteryPeriod seconds
			lotteryTicketsLimit, // _lotteryTicketsLimit num of tickets
			{from: owner}
		);
	});

    describe("buyLotteryTicket (for Eth)", () => {
        it("Payer should get lotteryTicket successfuly", async () => {
            const lotteryTicketsBalanceBefore = await lotteryInstance.balanceOf(accounts[1]);
            
            await lotteryInstance.methods["pickLotteryTicket()"]({from: accounts[1], value: ticketCost});
            const lotteryTicketsBalanceAfter = await lotteryInstance.balanceOf(accounts[1]);

            assert.equal(true, lotteryTicketsBalanceAfter.eq(
                lotteryTicketsBalanceBefore.add(toBN(1))
            ));
        });

        it("Payer should get lotteryTicket and change successfuly", async () => {
            const accountBalanceBefore = toBN(await web3.eth.getBalance(accounts[1]));

            const ethToSend = ticketCost.mul(toBN(2)); // Send twice more than a ticket cost

            const getLotteryTicketCall = await lotteryInstance.methods["pickLotteryTicket()"]({from: accounts[1], value: ethToSend});
            const gasUsed = toBN(getLotteryTicketCall.receipt.gasUsed);
            const currentGasPrice = toBN((await web3.eth.getTransaction(getLotteryTicketCall.tx)).gasPrice);
            
            const lotteryTicketsBalanceAfter = await lotteryInstance.balanceOf(accounts[1]);
            const accountBalanceAfter = toBN(await web3.eth.getBalance(accounts[1]));

            assert.equal(true, accountBalanceAfter.eq(
                accountBalanceBefore.sub(
                    gasUsed.mul(currentGasPrice)
                ).sub(ticketCost)
            ));
            assert.equal(true, lotteryTicketsBalanceAfter.eq(toBN(1)));
        });
    });

    describe("finishLottery", () => {
        it("If no one joined the lottery the lottery creator should be the winner", async () => {
            increaseTime(web3, timeAfterLotteryHasFinished); // increase time to finish lottey

            const result = await lotteryInstance.methods["finishLottery()"]({from: accounts[1]});

            // No one joined the lottery, so the winner is equal to Lottery creator
            truffleAssert.eventEmitted(result, 'LotteryIsFinished', (eventData: any) => {
                return eventData["winner"] == owner;
            });
        });

        it("Lottery should choose random winner correctly", async () => {
            for(let i = 1; i <= lotteryTicketsLimit; i++)
                await lotteryInstance.methods["pickLotteryTicket()"]({from: accounts[i], value: ticketCost});
            
            increaseTime(web3, timeAfterLotteryHasFinished);

            const accountsBalancesBefore = await getBalances(web3, accounts);
            const result = await lotteryInstance.methods["finishLottery()"]({from: owner});
            const accountsBalancesAfter = await getBalances(web3, accounts);
            
            //chech who is the winner according to the balance change
            let winnerAccount: string = "";
            // Start from i = 1, to exclude the lottery creator
            for(let i = 1; i< accounts.length; i++) {
                if(parseInt(accountsBalancesAfter[i]) - parseInt(accountsBalancesBefore[i]) > 0) {
                    winnerAccount = accounts[i];
                    break;
                }
            }
            truffleAssert.eventEmitted(result, 'LotteryIsFinished', (eventData: any) => {
                return eventData["winner"] == winnerAccount;
            });
        });

        it("Lottery should not be finished until the specified time come", async () => {
            await truffleAssert.reverts(
                lotteryInstance.methods["finishLottery()"]({from: accounts[1]}),
                "Lottery is not finished"
            );
        });
    });

    describe("destroy", () => {
        it("Should be able to call destroy function successfully by Owner", async () => {
            increaseTime(web3, timeAfterLotteryHasFinished); // increase time to finish lottery

            await lotteryInstance.methods["finishLottery()"]({from: owner});
            await lotteryInstance.destroy({from: owner});
            const lotteryCodeAfterSelfdestruct = await web3.eth.getCode(lotteryInstance.address);

            assert.equal(lotteryCodeAfterSelfdestruct, "0x");
        });

        it("Should fail destroy function call after Owner call durnig the lottery", async () => {
            await truffleAssert.reverts(
                lotteryInstance.destroy({from: owner}),
                "Impossible to destroy contract until the lottery is not finished"
            );
        });

        it("Should fail destroy function call after none Owner call", async () => {
            await truffleAssert.reverts(
                lotteryInstance.destroy({from: accounts[3]}),
                "Ownable: caller is not the owner"
            );
        });
    });
});
