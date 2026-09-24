#include "CFOP.h"
#include "../../CubeState/Rotation.h"
#include "Cross/Cross.h"
#include "F2L/F2L.h"
#include "OLL/OLL.h"
#include "PLL/PLL.h"

namespace CFOP {

// Cross searches, F2L and the last layer look their cases up
void buildTables() {
    F2L::buildTables();
    OLL::buildTables();
    PLL::buildTables();
}

// Execute One Stage and Keep Its Moves
static void append(std::vector<Move>& moves, CubeState& state,
                   const std::vector<Move>& step) {
    for (Move m : step) state = state.apply(m);
    moves.insert(moves.end(), step.begin(), step.end());
}

// Every stage works in the cross frame, the cheapest colour on the bottom
// Each stage is translated back so Main executes it in the scrambling frame like
// every other method
std::vector<Stage> stages(const CubeState& s) {
    CrossResult cross = Cross::bestCross(s);
    CubeState state = s.rotate(cross.hold);
    std::vector<Stage> result = {{"Cross", {}}, {"F2L", {}}, {"OLL", {}}, {"PLL", {}}};

    append(result[0].moves, state, cross.moves);
    for (const F2LPair& p : F2L::solve(state)) append(result[1].moves, state, p.moves);
    append(result[2].moves, state, OLL::solve(state));
    append(result[3].moves, state, PLL::solve(state));

    for (Stage& stage : result)
        for (Move& m : stage.moves) m = translateMove(m, cross.hold);
    return result;
}

std::vector<Move> solve(const CubeState& s) {
    std::vector<Move> moves;
    for (const Stage& stage : stages(s))
        moves.insert(moves.end(), stage.moves.begin(), stage.moves.end());
    return moves;
}

} // namespace CFOP
