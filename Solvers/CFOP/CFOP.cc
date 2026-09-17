#include "CFOP.h"
#include "../../CubeState/Rotation.h"
#include "Cross/Cross.h"
#include "F2L/F2L.h"
#include "OLL/OLL.h"
#include "PLL/PLL.h"

namespace CFOP {

// Cross and F2L search, only the last layer needs tables
void buildTables() {
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
// The solution is translated back at the end so Main executes it in the scrambling
// frame like every other method
std::vector<Move> solve(const CubeState& s) {
    CrossResult cross = Cross::bestCross(s);
    CubeState state = s.rotate(cross.hold);
    std::vector<Move> moves;

    append(moves, state, cross.moves);
    for (const F2LPair& p : F2L::solve(state)) append(moves, state, p.moves);
    append(moves, state, OLL::solve(state));
    append(moves, state, PLL::solve(state));

    for (Move& m : moves) m = translateMove(m, cross.hold);
    return moves;
}

} // namespace CFOP
