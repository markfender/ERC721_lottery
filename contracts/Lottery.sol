// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

//import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// todo: Add events
// todo: integrate chainlink

/// @title Solidity lottery implementation
/// @author Maksym Fedorenko
contract Lottery is Ownable, ERC721 {
	event LotteryIsFinished(address winner);

	uint256 public lotteryTicketPrice;
	uint64 public lotteryTimeStart;
	uint64 public lotteryPeriod;
	uint64 public lotteryTicketsLimit;

	using Counters for Counters.Counter;

	enum LotteryStatus {
		Active,
		PendingResult,
		Finished
	}

	Counters.Counter private _tokenIds;
	LotteryStatus public lotteryStatus = LotteryStatus.Finished;

	/// Initialize contract and start the lottery
	constructor(
		uint256 _lotteryTicketPrice,
		uint64 _lotteryPeriod,
		uint64 _lotteryTicketsLimit
	) ERC721("LotteryTicket", "LT") {
		//chainlinkFee = 0.1 * 10 ** 18; // 0.1 LINK fee

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
			uint64(_tokenIds.current()) < lotteryTicketsLimit &&
			lotteryTimeStart + lotteryPeriod >= uint64(block.timestamp) &&
			lotteryStatus == LotteryStatus.Active,
			"Lottery is finished"
		);

		_tokenIds.increment();
		uint64 newItemId = uint64(_tokenIds.current());
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
			uint64(_tokenIds.current()) >= lotteryTicketsLimit || lotteryTimeStart + lotteryPeriod < uint64(block.timestamp),
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

	/// @dev It is not a secure method, so it should be definitely replaced with a Oracles randomness in the future
	/// @param _randomValue Any random value which is used to get the winner
	/// @return Winner address
	function getWinner(uint256 _randomValue) private view returns (address) {
		require(lotteryStatus == LotteryStatus.PendingResult, "Wrong lottery status");
		if(_tokenIds.current() == 0) return owner();
		else return ownerOf((_randomValue % _tokenIds.current() ) + 1);
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

		for (; _tokenIds.current() != 0; _tokenIds.decrement()) {
			_burn(_tokenIds.current());
		}

		_tokenIds.reset();
		lotteryStatus = LotteryStatus.Active;
		lotteryTimeStart = uint64(block.timestamp);
	}

	/// Destroy contract
	function destroy() public onlyOwner {
		require(
			lotteryStatus == LotteryStatus.Finished,
			"Impossible to destroy contract until the lottery is not finished"
		);

		selfdestruct(payable(owner()));
	}
}
