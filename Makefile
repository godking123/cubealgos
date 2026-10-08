CXX = g++
CXXFLAGS = -std=c++17 -Wall -O2 -I. -MMD -MP
BUILD = .build

# The state layer: cube representation, moves, notation, scrambles. Knows nothing
# about how the cube is solved.
CORE = CubeState/CubeState.cc CubeState/MoveTable.cc CubeState/Scramble.cc \
       CubeState/Rotation.cc

# One block per solving method, plus the table that lets Main pick between them.
# A new method is a new directory here and one line in Solvers/Method.cc.
SOLVERS = Solvers/Method.cc \
          Solvers/KociembaNaive/Coords.cc Solvers/KociembaNaive/CoordTables.cc \
          Solvers/KociembaNaive/Phase1.cc Solvers/KociembaNaive/Phase2.cc \
          Solvers/KociembaNaive/Kociemba.cc \
          Solvers/CFOP/CFOP.cc Solvers/CFOP/PieceSearch.cc \
          Solvers/CFOP/Cross/Cross.cc Solvers/CFOP/F2L/F2L.cc \
          Solvers/CFOP/OLL/OLL.cc Solvers/CFOP/PLL/PLL.cc \
          Solvers/Roux/Roux.cc

# Scramble generators that need a solver, so they sit above both layers.
SCRAMBLERS = Scramblers/WCA.cc

CORE_OBJS = $(addprefix $(BUILD)/,$(notdir $(CORE:.cc=.o) $(SOLVERS:.cc=.o) \
                                          $(SCRAMBLERS:.cc=.o)))

ALL_OBJS = $(CORE_OBJS) $(BUILD)/Main.o $(BUILD)/Tests.o

.PHONY: all
all: cubealgo tests

cubealgo: $(BUILD)/Main.o $(CORE_OBJS)
	$(CXX) $(CXXFLAGS) $^ -o $@

tests: $(BUILD)/Tests.o $(CORE_OBJS)
	$(CXX) $(CXXFLAGS) $^ -o $@

# The same engine compiled to WebAssembly for the React front end in Web/, so the site
# is static files and every visitor's solves run in their own browser. Needs emsdk
EMXX = em++
EMFLAGS = -std=c++17 -O3 -I. -fwasm-exceptions -sMODULARIZE -sEXPORT_ES6 \
          -sENVIRONMENT=web,worker -sALLOW_MEMORY_GROWTH \
          -sEXPORTED_FUNCTIONS=_engine_init,_engine_call -sEXPORTED_RUNTIME_METHODS=cwrap
WASM = Web/src/engine/engine.mjs
HEADERS = $(wildcard CubeState/*.h Scramblers/*.h Solvers/*.h Solvers/*/*.h Solvers/*/*/*.h)

.PHONY: wasm web
wasm: $(WASM)

$(WASM): Web/engine/Engine.cc $(CORE) $(SOLVERS) $(SCRAMBLERS) $(HEADERS)
	@mkdir -p $(dir $@)
	$(EMXX) $(EMFLAGS) $(filter %.cc,$^) -o $@

web: $(WASM)
	cd Web && npm ci && npm run build

$(BUILD)/%.o: %.cc | $(BUILD)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD)/%.o: CubeState/%.cc | $(BUILD)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD)/%.o: Solvers/%.cc | $(BUILD)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD)/%.o: Solvers/KociembaNaive/%.cc | $(BUILD)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD)/%.o: Solvers/CFOP/%.cc | $(BUILD)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD)/%.o: Solvers/CFOP/Cross/%.cc | $(BUILD)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD)/%.o: Solvers/CFOP/F2L/%.cc | $(BUILD)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD)/%.o: Solvers/CFOP/OLL/%.cc | $(BUILD)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD)/%.o: Solvers/CFOP/PLL/%.cc | $(BUILD)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD)/%.o: Solvers/Roux/%.cc | $(BUILD)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD)/%.o: Scramblers/%.cc | $(BUILD)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD):
	@mkdir -p $(BUILD)

-include $(ALL_OBJS:.o=.d)

.PHONY: test
test: tests
	./tests

.PHONY: clean
clean:
	rm -rf $(BUILD) cubealgo tests Web/src/engine/engine.mjs Web/src/engine/engine.wasm Web/dist
