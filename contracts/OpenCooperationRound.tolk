tolk 1.4.2

import "@stdlib/tvm-dicts"

const PHASE_COMMIT = 0
const PHASE_REVEAL = 1
const PHASE_RESOLVED = 2

struct Storage {
    roundId: uint64
    duration: uint32
    revealDuration: uint32
    stakeType: uint8
    stakeAmount: coins
    startsAt: uint64
    phase: uint8
    settlement: int8
    commitments: cell?
    reveals: cell?
    claims: cell?
    participants: uint32
    cooperators: uint32
    defectors: uint32
}

fun Storage.load() { return Storage.fromCell(contract.getData()) }
fun Storage.save(self) { contract.setData(self.toCell()) }

struct (0x6f70656e) Commit {
    queryId: uint64
    commitment: uint256
}

struct (0x7265766c) Reveal {
    queryId: uint64
    action: bool
    salt: uint256
}

struct (0x7265736f) Resolve { queryId: uint64 }
struct (0x636c616d) Claim { queryId: uint64 }
type RoundMessage = Commit | Reveal | Resolve | Claim

fun commitmentHash(action: bool, salt: uint256): uint256 {
    return beginCell().storeBool(action).storeUint(salt, 256).endCell().hash()
}

fun participantKey(sender: address): uint256 {
    val (_, hash) = sender.getWorkchainAndHash();
    return hash;
}

fun onInternalMessage(in: InMessage) {
    val msg = lazy RoundMessage.fromSlice(in.body);
    var storage = lazy Storage.load();
    val now = blockchain.now();
    val key = participantKey(in.senderAddress);

    match (msg) {
        Commit => {
            assert (storage.phase == PHASE_COMMIT) throw 100;
            assert (now < storage.startsAt + storage.duration) throw 101;
            val old = storage.commitments.uDictGet(256, key);
            assert (!old.1) throw 102;
            storage.commitments.uDictSetBuilder(256, key, beginCell().storeUint(msg.commitment, 256));
            storage.participants += 1;
        }
        Reveal => {
            assert (storage.phase == PHASE_COMMIT || storage.phase == PHASE_REVEAL) throw 110;
            assert (now >= storage.startsAt + storage.duration) throw 111;
            assert (now < storage.startsAt + storage.duration + storage.revealDuration) throw 112;
            storage.phase = PHASE_REVEAL;
            var commitment = storage.commitments.uDictGet(256, key);
            assert (commitment.1) throw 113;
            val alreadyRevealed = storage.reveals.uDictGet(256, key);
            assert (!alreadyRevealed.1) throw 114;
            var commitmentSlice = commitment.0!;
            assert (commitmentSlice.loadUint(256) == commitmentHash(msg.action, msg.salt)) throw 115;
            storage.reveals.uDictSetBuilder(256, key, beginCell().storeBool(msg.action));
            if (msg.action) { storage.cooperators += 1; } else { storage.defectors += 1; }
        }
        Resolve => {
            assert (storage.phase == PHASE_COMMIT || storage.phase == PHASE_REVEAL) throw 120;
            assert (now >= storage.startsAt + storage.duration + storage.revealDuration) throw 121;
            if (storage.cooperators > storage.defectors) {
                storage.settlement = 1;
            } else if (storage.defectors > storage.cooperators) {
                storage.settlement = -1;
            } else {
                storage.settlement = 0;
            }
            storage.phase = PHASE_RESOLVED;
        }
        Claim => {
            assert (storage.phase == PHASE_RESOLVED) throw 130;
            val participant = storage.reveals.uDictGet(256, key);
            assert (participant.1) throw 131;
            val alreadyClaimed = storage.claims.uDictGet(256, key);
            assert (!alreadyClaimed.1) throw 132;
            storage.claims.uDictSetBuilder(256, key, beginCell().storeUint(1, 1));
        }
        else => { assert (in.body.isEmpty()) throw 0xFFFF; }
    }
    storage.save();
}

fun onBouncedMessage(in: InMessageBounced) {}

get fun roundConfig(): (int, int, int, int, int, int, int) {
    val storage = lazy Storage.load();
    return (storage.roundId, storage.duration, storage.revealDuration, storage.stakeType,
        storage.stakeAmount, storage.startsAt, storage.phase);
}

get fun roundStats(): (int, int, int, int, int) {
    val storage = lazy Storage.load();
    return (storage.participants, storage.cooperators, storage.defectors, storage.phase, storage.settlement);
}