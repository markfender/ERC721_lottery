// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;
/// NOTICE: Just for testing purpose!

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// Contract interface for receivers of tokens that
/// comply with ERC-677.
/// See https://github.com/ethereum/EIPs/issues/677 for details.
interface IERC677TransferReceiver {
	function tokenFallback(
		address from,
		uint256 amount,
		bytes calldata data
	) external returns (bool);
}

/// Mock for link tokens testing purpose
contract LinkTokenMock is ERC20 {
	constructor(address _addressToMint, uint256 _amount) ERC20("LINK Token", "LINK") {
		_mint(_addressToMint, _amount);
	}

	/// ERC-677's only method implementation
	/// See https://github.com/ethereum/EIPs/issues/677 for details
	function transferAndCall(
		address _to,
		uint256 _value,
		bytes memory _data
	) external returns (bool) {
		bool result = super.transfer(_to, _value);
		if (!result) return false;

		IERC677TransferReceiver receiver = IERC677TransferReceiver(_to);
		receiver.tokenFallback(msg.sender, _value, _data);

		return true;
	}
}
