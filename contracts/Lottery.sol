// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;


import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";

// todo: Add events
// todo: Investigate gas consumption
// todo: Add opportunity to create a lottery with flexible ticket cost

/// @title Solidity lottery implementation
/// @author Maksym Fedorenko
contract Lottery is Ownable, ERC721, VRFConsumerBase {
	event LotteryIsFinished(address winner);

	uint256 public lotteryTicketPrice;
	uint64 public lotteryTimeStart;
	uint64 public lotteryPeriod;
	uint64 public lotteryTicketsLimit;
	uint64 constant private chainlinkFee = 10 ** 17; // 0.1 LINK fee;

	using Counters for Counters.Counter;

	enum LotteryStatus {
		Active,
		PendingResult,
		Finished
	}

	Counters.Counter private _ticketIds;
	LotteryStatus public lotteryStatus = LotteryStatus.Finished;

	/// Initialize contract and start the lottery
	/// Constructor inherits VRFConsumerBase
	/// @param _VRFCoordinator Address for chainlink VRF Coordinator, it may vary in different networks
	/// @param _LINKToken LINK Token contract address
	constructor(
		address _VRFCoordinator,
		address _LINKToken,
		uint256 _lotteryTicketPrice,
		uint64 _lotteryPeriod,
		uint64 _lotteryTicketsLimit
	) ERC721("LotteryTicket", "LT") VRFConsumerBase(
		_VRFCoordinator,
		_LINKToken
	) {
		startLottery(
			_lotteryTicketPrice,
			_lotteryPeriod,
			_lotteryTicketsLimit
		);
	}

	/// @notice Return the change (in ether), if the lottery ticket costs less than it was payed
	/// @return Lottery ticket number
	function pickLotteryTicket() public payable returns (uint64) {
		require(msg.value >= lotteryTicketPrice, "Not enough ether to get the ticket");
		require(
			uint64(_ticketIds.current()) < lotteryTicketsLimit &&
			lotteryTimeStart + lotteryPeriod >= uint64(block.timestamp) &&
			lotteryStatus == LotteryStatus.Active,
			"Lottery is finished"
		);

		_ticketIds.increment();
		uint64 newItemId = uint64(_ticketIds.current());
		_safeMint(_msgSender(), uint256(newItemId));

		uint256 change = msg.value - lotteryTicketPrice;
		if (change >= 1) {
			(bool sent, ) = _msgSender().call{value: change}("Return the change");
			require(sent, "Failed to send the change");
		}
		return newItemId;		
	}

	/// @notice Allows to finish the lottery whan the tickets or time is over
	/// @dev Everyone can call it, so the required statements should be tested properly 
	function finishLottery() public {
		require(lotteryStatus == LotteryStatus.Active, "Wrong lottery status");
		require(
			uint64(_ticketIds.current()) >= lotteryTicketsLimit || lotteryTimeStart + lotteryPeriod < uint64(block.timestamp),
			"Lottery is not finished"
		);

		lotteryStatus = LotteryStatus.PendingResult; // Change lottery status to avoid double request \

		getRandomNumber();	
	}

	/// @param _randomValue Any random value which is used to get the winner address
	/// @return Winner address
	function getWinner(uint256 _randomValue) private view returns (address) {
		require(lotteryStatus == LotteryStatus.PendingResult, "Wrong lottery status");
		if(_ticketIds.current() == 0) return owner();
		else return ownerOf((_randomValue % _ticketIds.current() ) + 1);
	}

	/// @param _winner The winner address
	/// @dev It send 90% of aggregated ether to the winner and 10% to the lottery owner
	function sendReward(address _winner) private {
		require(lotteryStatus == LotteryStatus.PendingResult);

		lotteryStatus = LotteryStatus.Finished;
		payable(_winner).transfer(address(this).balance / 100 * 90); // send 90 percents to the winner
		payable(owner()).transfer(address(this).balance); // send the rest to the owner
	}

	/// Restart the lottery
	function restartLottery(
		uint256 _lotteryTicketPrice,
		uint64 _lotteryPeriod,
		uint64 _lotteryTicketsLimit
	) public onlyOwner {
		require(lotteryStatus == LotteryStatus.Finished, "The lottery isn't finished");

		startLottery(
			_lotteryTicketPrice,
			_lotteryPeriod,
			_lotteryTicketsLimit
		);
	}

	/// @param _lotteryTicketPrice The price per one lottery NFT ticket in wei
	/// @param _lotteryPeriod The lottery period, specified in seconds
	/// @param _lotteryTicketsLimit The limit of the tickets in the lottery
	function startLottery(
		uint256 _lotteryTicketPrice,
		uint64 _lotteryPeriod,
		uint64 _lotteryTicketsLimit
	) private {
		lotteryTicketPrice = _lotteryTicketPrice;
		lotteryPeriod = _lotteryPeriod;
		lotteryTicketsLimit = _lotteryTicketsLimit;

		for (; _ticketIds.current() != 0; _ticketIds.decrement()) {
			_burn(_ticketIds.current());
		}

		_ticketIds.reset();
		lotteryStatus = LotteryStatus.Active;
		lotteryTimeStart = uint64(block.timestamp);
	}

	/// Requests randomness 
	/// @return requestId Identificator of the request
	function getRandomNumber() private returns (bytes32 requestId) {
		require(LINK.balanceOf(address(this)) >= uint256(chainlinkFee), "Not enough LINK");

		return requestRandomness(
			0x6c3699283bda56ad74f6b855546325b68d482e983852a7a82979cc4807b641f4, // Chainlink key hash
			uint256(chainlinkFee)
		);
	}

	/// Callback function used by VRF Coordinator
	function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
		address theWinner = getWinner(randomness);
		sendReward(theWinner);
		emit LotteryIsFinished(theWinner);
	}

	/// Destroy contract
	function destroy() public onlyOwner {
		require(
			lotteryStatus == LotteryStatus.Finished,
			"Impossible to destroy contract until the lottery is not finished"
		);
		
		// Withdraw LINK tokens
		LINK.transfer(owner(), LINK.balanceOf(address(this)));
		selfdestruct(payable(owner()));
	}
}
