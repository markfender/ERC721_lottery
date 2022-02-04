import { assert, web3, artifacts, network } from "hardhat";
const truffleAssert = require('truffle-assertions');
const { increaseTime } = require('./utils/timeManipulation');

const Lottery = artifacts.require("Lottery");

const toBN = web3.utils.toBN;
const bn1e18 = toBN(1e18);

describe("Exchange", () => {
	let accounts: string[];
	let owner: string;
	let payer: string;
	let lotteryInstance: any;
    const ticketCost = toBN(1).mul(toBN(1e9)); // 1 gwei

	const payerAccount = "0x" + process.env.ADDRESS_TESTNET;


	beforeEach(async () => {
		accounts = await web3.eth.getAccounts();
		owner = accounts[0];
		payer = "0x" + process.env.ADDRESS_TESTNET;

        // Just for testing purpose
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [payer],
		});

		lotteryInstance = await Lottery.new(
			ticketCost, //_lotteryTicketPrice in wei
			120, // _lotteryPeriod seconds
			3, // _lotteryTicketsLimit
			{from: owner}
		);

        await web3.eth.sendTransaction({from: accounts[1], to: payer, value: toBN(700).mul(bn1e18)});
	});

    describe("buyLotteryTicket (for Eth)", () => {
        it( "Payer should get lotteryTicket successfuly", async () => {
            const lotteryTicketsBalanceBefore = await lotteryInstance.balanceOf(payer);

            
            const result = await lotteryInstance.methods["pickLotteryTicket()"]({from: payer, value: ticketCost});
            const lotteryTicketsBalanceAfter = await lotteryInstance.balanceOf(payer);

            assert.equal(true, lotteryTicketsBalanceAfter.eq(
                lotteryTicketsBalanceBefore.add(toBN(1))
            ));
        });
    });

    describe("finishLottery (by creator)", () => {
        it("If no one joined the lottery the lottery creator should be the winner", async () => {
            increaseTime(web3, 190);

            const result = await lotteryInstance.methods["finishLottery()"]({from: payer});

            // No one joined the lottery, so the winner is equal to Lottery creator
            truffleAssert.eventEmitted(result, 'LotteryIsFinished', (ev: any) => {
                return ev["winner"] == owner;
            });
        });
    });

    describe("finishLottery (by anyone)", () => {
        it("Lottery should choose winner correctly, if just one account participated", async () => {
            await lotteryInstance.methods["pickLotteryTicket()"]({from: payer, value: ticketCost});
            
            increaseTime(web3, 190);

            const result = await lotteryInstance.methods["finishLottery()"]({from: payer});

            truffleAssert.eventEmitted(result, 'LotteryIsFinished', (ev: any) => {
                return ev["winner"] == payer;
            });
        });

        it( "Lottery shouldn't be finished immediently", async () => {
            await truffleAssert.reverts(
                lotteryInstance.methods["finishLottery()"]({from: payer}),
                "Lottery is not finished"
            );
        });
    });
});
/*const HOME_STUDENTS_RINKEBY = "0x0E822C71e628b20a35F8bCAbe8c11F274246e64D";

describe("Exchange", () => {
    let accounts: string[];
    let owner: any;
    let payer: any;
    let fenderTokenInstance: any;
    let exchangeInstance: any;
    let tokenDAI: any;

    const paymentAmount = bn1e18.muln(1);
    const payerAccount = "0x" + process.env.ADDRESS_TESTNET;

 
    describe( "buyTokens (for Eth)", () => {
        it("Should buyTokens successfully", async () => {
            const tokenBalanceBefore = await fenderTokenInstance.balanceOf(payer);
            const exchangeTokenBalanceBefore = await fenderTokenInstance.balanceOf(exchangeInstance.address);

            const result = await exchangeInstance.methods["buyTokens()"]({from: payer, value: paymentAmount});

            truffleAssert.eventEmitted(result, 'Bought', (ev: any) => {
                return ev.payer.toLowerCase() === payer.toLowerCase() && ev.value.eq(toBN("1").mul(bn1e18));
            });

            const exchangeTokenBalanceAfter = await fenderTokenInstance.balanceOf(exchangeInstance.address);
            const tokenBalanceAfter = await fenderTokenInstance.balanceOf(payer);

            assert.notEqual(toBN(0), exchangeTokenBalanceBefore.sub(exchangeTokenBalanceAfter));
            assert.equal(true, tokenBalanceBefore.eq(tokenBalanceAfter.sub(exchangeTokenBalanceBefore.sub(exchangeTokenBalanceAfter))));
        });

        
        it("Should get back ether for too much bought amount", async () => {
            const ethBalanceBefore = await web3.eth.getBalance(payer);
            const result = await exchangeInstance.methods["buyTokens()"]({from: payer, value: paymentAmount.mul(toBN(20))});
      
            truffleAssert.eventEmitted(result, 'BoughtFailed', (ev: any) => {
                return ev.payer.toLowerCase() === payer.toLowerCase() && ev.value.eq(paymentAmount.mul(toBN(20)));
            });
      
            const ethBalanceAfter = await web3.eth.getBalance(payer);
      
            const transaction = await web3.eth.getTransaction(result.tx);
            assert.equal(
                true,
                toBN(result.receipt.gasUsed)
                    .mul(toBN(transaction.gasPrice))
                        .eq(toBN(ethBalanceBefore)
                            .sub(toBN(ethBalanceAfter)))
            );
        });

        it("Should not be able to buy tokens due to 0 eth sent", async () => {
            await truffleAssert.reverts(
                exchangeInstance.methods["buyTokens()"]({from: payer, value: 0}), 
                "Send ETH to buy some tokens"
            );
        });
      
    });

    describe( "buyTokens (for DAI)", () => {
        it("Should buyTokens successfully for DAI", async () => {
            const daiAmountToSend = toBN(1).mul(bn1e18);
            await tokenDAI.methods.approve(exchangeInstance.address, daiAmountToSend).send({from: payer})

            const exchangeDaiBalanceBefore = await tokenDAI.methods.balanceOf(exchangeInstance.address).call();
            const payerDaiBalanceBefore = await tokenDAI.methods.balanceOf(payer).call();
            
            const result = await exchangeInstance.buyTokens(
                daiAmountToSend,
                "0x5592EC0cfb4dbc12D3aB100b257153436a1f0FEa",
                {from: payer}
            );

            const exchangeDaiBalanceAfter = await tokenDAI.methods.balanceOf(exchangeInstance.address).call();
            const payerDaiBalanceAfter = await tokenDAI.methods.balanceOf(payer).call();
            
            assert.equal(true, toBN(payerDaiBalanceBefore).eq(
                toBN(payerDaiBalanceAfter)
                .add(daiAmountToSend)));
            assert.equal(true, daiAmountToSend.eq(
                toBN(exchangeDaiBalanceAfter)));
        });

        it("Should fail buyTokens for DAI (no allowence)", async () => {
            await truffleAssert.reverts(
                exchangeInstance.buyTokens(
                    web3.utils.toBN(10).mul(bn1e18),
                    "0x5592EC0cfb4dbc12D3aB100b257153436a1f0FEa",
                    {from: payer}
                ), 
                "You do not have enough tokens or not in allowence"
            );
        });

        it("Should fail buyTokens for DAI (token not acceptable)", async () => {
            const daiAmountToSend = toBN(1).mul(bn1e18);
            await tokenDAI.methods.approve(exchangeInstance.address, daiAmountToSend).send({from: payer})

            const NOT_ACCEPTABLE_TOKEN_ADDRESS = "0x01be23585060835e02b77ef475b0cc51aa1e0709";

            await truffleAssert.reverts(
                exchangeInstance.buyTokens(
                    daiAmountToSend,
                    NOT_ACCEPTABLE_TOKEN_ADDRESS,
                    {from: payer}
                ), 
                "Sorry, token is not acceptable"
            );
        });
    });
    describe("withdraw", () => {
        it("Get Exchange Eth balance", async () => {
            const exchangeTokenBalanceBefore = await fenderTokenInstance.balanceOf(exchangeInstance.address);

            const result = await exchangeInstance.methods["buyTokens()"]({from: payer, value: paymentAmount});
            const exchangeBalance = await exchangeInstance.getBalance();

            truffleAssert.eventEmitted(result, 'Bought', (ev: any) => {
                return ev.payer.toLowerCase() === payer.toLowerCase() && ev.value.eq(exchangeBalance);
            });
        });

        it("Get Eth back", async () => {
            const exchangeTokenBalanceBefore = await fenderTokenInstance.balanceOf(exchangeInstance.address);
            const result = await exchangeInstance.methods["buyTokens()"]({from: payer, value: paymentAmount});

            const payerBalanceBefore = await web3.eth.getBalance(payer);

            await exchangeInstance.withdraw(payer, {from: owner});

            const payerBalanceAfter = await web3.eth.getBalance(payer);

            assert.equal(true, toBN(payerBalanceAfter)
                .eq(toBN(payerBalanceBefore)
                    .add(paymentAmount)))

        });
    });
    describe( "destroy", () => {
        it("Should be able to call destroy function successfully by Owner", async () => {
            const result = await exchangeInstance.destroy({from: owner});
            
            truffleAssert.eventEmitted(result, 'Destroy', (ev: any) => {
                return ev.currentContract.toLowerCase() === exchangeInstance.address.toLowerCase();
            });
        });

        it("Should fail destroy function call on none Owner call", async () => {
            await truffleAssert.reverts(
                exchangeInstance.destroy({from: payer}),
                "This can only be called by the contract owner!"
            );            
        });
    });
});
*/