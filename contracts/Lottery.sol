// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
//import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";



/* contract Lottery is Ownable, VRFConsumerBase { */
contract Lottery is Ownable, ERC721 {

	event LotteryIsFinished(address winner);
	// todo: Add events
	// todo: Add comments
	// todo: integrate chainlink
	using Counters for Counters.Counter;

	enum LotteryStatus {
		Active,
		PendingResult,
		Finished
	}

    Counters.Counter private _tokenIds;
	LotteryStatus public lotteryStatus = LotteryStatus.Finished;

	uint256 public lotteryTicketPrice;
	uint256 public lotteryPeriod;
	uint256 public lotteryTicketsLimit;
	uint256 public lotteryTimeStart;

	/*
	address private LINK_TOKEN = 0xa36085F69e2889c224210F603D836748e7dC0088;
	address private VRF_COORDINATOR = 0xdD3782915140c8f3b190B5D67eAc6dc5760C46E9;
	bytes32 internal keyHash = 0x6c3699283bda56ad74f6b855546325b68d482e983852a7a82979cc4807b641f4;
	uint256 internal chainlinkFee;
	 VRFConsumerBase(
		VRF_COORDINATOR,
		LINK_TOKEN
	) */
	constructor(
		uint256 _lotteryTicketPrice,
		uint256 _lotteryPeriod,
		uint256 _lotteryTicketsLimit
	) ERC721("LotteryTicket", "LT") {
		//chainlinkFee = 0.1 * 10 ** 18; // 0.1 LINK fee

		startLottery(
			_lotteryTicketPrice,
			_lotteryPeriod,
			_lotteryTicketsLimit
		);
	}

	function pickLotteryTicket() public payable returns (uint256) {
		require(msg.value >= lotteryTicketPrice, "Not enough ether to get the ticket");
		require(
			_tokenIds.current() < lotteryTicketsLimit &&
			lotteryTimeStart + lotteryPeriod >= block.timestamp &&
			lotteryStatus == LotteryStatus.Active,
			"Lottery is finished"
		);

		_tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        _safeMint(msg.sender, newItemId);

		uint256 change = msg.value - lotteryTicketPrice;
		if (change >= 1) {
			(bool sent, ) = msg.sender.call{value: change}("Return the change");
			require(sent, "Failed to send the change");
		}
        return newItemId;		
	}

	function finishLottery() public {
		require(lotteryStatus == LotteryStatus.Active, "Wrong lottery status");
		require(
			_tokenIds.current() >= lotteryTicketsLimit || lotteryTimeStart + lotteryPeriod < block.timestamp,
			"Lottery is not finished"
		);

		lotteryStatus = LotteryStatus.PendingResult;

		// todo: replace fake randomness with a chainlink
		address theWinner = getWinner(
			uint(keccak256(abi.encodePacked(block.timestamp, block.difficulty, msg.sender)))
		);
		sendReward(theWinner);

		emit LotteryIsFinished(theWinner);
	}

	function getWinner(uint256 _randomValue) private view returns (address) {
		require(lotteryStatus == LotteryStatus.PendingResult, "Wrong lottery status");
		if(_tokenIds.current() == 0) return owner();
		else return ownerOf((_randomValue % _tokenIds.current() ) + 1);
	}

	function sendReward(address _winner) private {
		require(lotteryStatus == LotteryStatus.PendingResult);

		lotteryStatus = LotteryStatus.Finished;
		payable(_winner).transfer(address(this).balance / 100 * 90); // send 90 percents to the winner
		payable(owner()).transfer(address(this).balance); // send the rest to the owner
	}

	function restartLottery(uint256 _lotteryTicketPrice, uint256 _lotteryPeriod, uint256 _lotteryTicketsLimit) public onlyOwner {
		require(lotteryStatus == LotteryStatus.Finished, "The lottery isn't finished");

		startLottery(
			_lotteryTicketPrice,
			_lotteryPeriod,
			_lotteryTicketsLimit
		);
	}

	function startLottery(uint256 _lotteryTicketPrice, uint256 _lotteryPeriod, uint256 _lotteryTicketsLimit) private {
		lotteryTicketPrice = _lotteryTicketPrice;
		lotteryPeriod = _lotteryPeriod;
		lotteryTicketsLimit = _lotteryTicketsLimit;

		for (; _tokenIds.current() != 0; _tokenIds.decrement()) {
			_burn(_tokenIds.current());
		}

		_tokenIds.reset();
		lotteryStatus = LotteryStatus.Active;
		lotteryTimeStart = block.timestamp;
	}


	/** 
	 * Requests randomness 

	function getRandomNumber() public returns (bytes32 requestId) {
		require(LINK.balanceOf(address(this)) >= fee, "Not enough LINK - fill contract with faucet");
		return requestRandomness(keyHash, fee);
	}

	/**
	 * Callback function used by VRF Coordinator

	function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
		randomResult = randomness;
	} */

	//Destroy contract
	function destroy() public onlyOwner {
		selfdestruct(payable(owner()));
	}
}
