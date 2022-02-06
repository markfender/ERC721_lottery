// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;
/// NOTICE: Just for testing purpose!

import "@chainlink/contracts/src/v0.8/mocks/VRFCoordinatorMock.sol";

contract CoordinatorMock is VRFCoordinatorMock {
	event LinkTokenRecived(address from, uint256 amount, bytes data);
		
	constructor(address _linkAddress) VRFCoordinatorMock(_linkAddress) {}

	function tokenFallback(
		address _from,
		uint256 _amount,
		bytes calldata _data
	) external returns (bool) {
		emit LinkTokenRecived(_from, _amount, _data);
		onTokenTransfer(_from, _amount, _data);
		return true;
	}
}