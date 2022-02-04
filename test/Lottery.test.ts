import { assert, web3, artifacts, network } from "hardhat";
const truffleAssert = require('truffle-assertions');
const { increaseTime } = require('./utils/timeManipulation');

const Lottery = artifacts.require("Lottery");

const toBN = web3.utils.toBN;
const bn1e18 = toBN(1e18);

// todo: Move to utils
const getBalances = async (accounts: string[]) => {
    return await Promise.all(
        accounts.map(async (account) => web3.eth.getBalance(account))
    )
}

describe("Exchange", () => {
	let accounts: string[];
	let owner: string;
	let payer: string;
	let lotteryInstance: any;
    const lotteryPeriodInSeconds = 120; // 3 minutes
    const timeAfterLotteryHasFinished = lotteryPeriodInSeconds * 2;
    const ticketCost = toBN(2).mul(toBN(1e18)); // 2 eth
    const lotteryTicketsLimit = 3; // 3 tickets

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
        it( "Payer should get lotteryTicket successfuly", async () => {
            const lotteryTicketsBalanceBefore = await lotteryInstance.balanceOf(accounts[1]);
            
            await lotteryInstance.methods["pickLotteryTicket()"]({from: accounts[1], value: ticketCost});
            const lotteryTicketsBalanceAfter = await lotteryInstance.balanceOf(accounts[1]);

            assert.equal(true, lotteryTicketsBalanceAfter.eq(
                lotteryTicketsBalanceBefore.add(toBN(1))
            ));
        });
    });

    describe("finishLottery (by creator)", () => {
        it("If no one joined the lottery the lottery creator should be the winner", async () => {
            increaseTime(web3, timeAfterLotteryHasFinished); // increase time to finish lottey

            const result = await lotteryInstance.methods["finishLottery()"]({from: accounts[1]});

            // No one joined the lottery, so the winner is equal to Lottery creator
            truffleAssert.eventEmitted(result, 'LotteryIsFinished', (eventData: any) => {
                return eventData["winner"] == owner;
            });
        });
    });

    describe("finishLottery (by anyone)", () => {
        it("Lottery should choose random winner correctly", async () => {
            for(let i = 1; i <= lotteryTicketsLimit; i++)
                await lotteryInstance.methods["pickLotteryTicket()"]({from: accounts[i], value: ticketCost});
            
            increaseTime(web3, timeAfterLotteryHasFinished);

            const accountsBalancesBefore = await getBalances(accounts);
            const result = await lotteryInstance.methods["finishLottery()"]({from: owner});
            const accountsBalancesAfter = await getBalances(accounts);
            
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

        it( "Lottery shouldn't be finished immediently", async () => {
            await truffleAssert.reverts(
                lotteryInstance.methods["finishLottery()"]({from: accounts[1]}),
                "Lottery is not finished"
            );
        });
    });
});
