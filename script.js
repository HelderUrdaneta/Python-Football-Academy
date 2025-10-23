document.addEventListener('DOMContentLoaded', function() {
    // Preload images
    for (let i = 1; i <= 18; i++) { new Image().src = `./personajes/personaje${i}.png`; }
    for (let i = 1; i <= 10; i++) { new Image().src = `./defensas/defensa${i}.png`; }
    new Image().src = './campo/balon.png';
    new Image().src = './campo/campo.png';
    
    const editor = CodeMirror.fromTextArea(document.getElementById('code-editor'), {
        mode: 'python',
        theme: 'monokai',
        lineNumbers: true,
        indentUnit: 4
    });

    // Carousel setup
    const avatarList = document.getElementById('avatar-list');
    for (let i = 1; i <= 18; i++) {
        const slide = document.createElement('li');
        slide.className = 'splide__slide';
        slide.innerHTML = `
            <div class="avatar-slide" data-avatar-id="${i}">
                <img src="./personajes/personaje${i}.png" class="avatar-img" alt="Personaje ${i}">
                <span>Personaje ${i}</span>
            </div>`;
        avatarList.appendChild(slide);
    }
    new Splide('#avatar-carousel', { perPage: 3, gap: 10, pagination: false }).mount();

    const gameState = {
        player: { x: 0, y: 0, direction: 'right', hasBall: false, avatarId: 1 },
        ball: { x: 0, y: 0, visible: true },
        defenses: [],
        grid: { width: 10, height: 8 },
        goalArea: { x: 9, y: [3, 4] },
        currentLevel: 1,
        moves: 0,
        bestScores: {},
        running: false,
        speed: 5,
        playerName: 'Invitado',
        stepExecution: null,
        stepState: null,
        highlightingEnabled: true,
        lastHighlightedLine: null
    };

    const levels = [
        { id: 1, title: "Tutorial: Recoge el balón", description: "Usa `avanzar()` y `recoger_balon()` para tomar el balón y llevarlo a la portería.", playerStart: { x: 0, y: 4 }, ballPosition: { x: 2, y: 4 }, defenses: []},
        { id: 2, title: "Esquiva al defensor", description: "Hay un defensor. Usa `girar_izquierda()` y `avanzar()` para rodearlo.", playerStart: { x: 0, y: 3 }, ballPosition: { x: 1, y: 3 }, defenses: [{ x: 4, y: 3 }]},
        { id: 3, title: "Usa Bucles", description: "Define una función con un bucle `for` para moverte varias casillas y evitar repetir código.", playerStart: { x: 0, y: 2 }, ballPosition: { x: 6, y: 2 }, defenses: [{ x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 }]},
        // Nuevos niveles
        { id: 4, title: "Doble marca", description: "Esquiva varios defensores, recoge el balón y entrégalo al compañero cerca del área antes de agotar los movimientos (máx 14).", playerStart: { x: 0, y: 4 }, ballPosition: { x: 1, y: 4 }, defenses: [
            { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 }, { x: 5, y: 3 }, { x: 6, y: 4 }
        ], teammate: { x: 8, y: 3, spriteId: 15 }, target: { x: 8, y: 3 }, maxMoves: 14 },
        { id: 5, title: "Embudo defensivo", description: "Lleva el balón a tu compañero en el carril derecho. Planifica bien las vueltas (máx 16 movimientos).", playerStart: { x: 0, y: 2 }, ballPosition: { x: 2, y: 2 }, defenses: [
            { x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 6, y: 2 }, { x: 7, y: 2 }, { x: 7, y: 3 }
        ], teammate: { x: 8, y: 2, spriteId: 16 }, target: { x: 8, y: 2 }, maxMoves: 16 },
        { id: 6, title: "Pases milimétricos", description: "Entre líneas: evita la muralla y entrega el balón a tu compañero (máx 18 movimientos).", playerStart: { x: 1, y: 5 }, ballPosition: { x: 2, y: 5 }, defenses: [
            { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 6 }, { x: 5, y: 4 }, { x: 6, y: 5 }, { x: 7, y: 4 }, { x: 7, y: 6 }
        ], teammate: { x: 8, y: 4, spriteId: 14 }, target: { x: 8, y: 4 }, maxMoves: 18 }
    ];

    // DOM Elements
    const elements = {
        gameGrid: document.getElementById('game-grid'),
        movesCounter: document.getElementById('moves-counter'),
        currentLevel: document.getElementById('current-level'),
        bestScore: document.getElementById('best-score'),
        missionTitle: document.getElementById('mission-title'),
        missionDescription: document.getElementById('mission-description'),
        runButton: document.getElementById('run-button'),
        startButton: document.getElementById('start-button'),
        stepSingleButton: document.getElementById('step-single-button'),
        stopButton: document.getElementById('stop-button'),
        speedSlider: document.getElementById('speed-slider'),
        levelCompletePanel: document.getElementById('level-complete'),
        movesUsed: document.getElementById('moves-used'),
        recordMessage: document.getElementById('record-message'),
        recordMoves: document.getElementById('record-moves'),
        nextLevelButton: document.getElementById('next-level'),
        resetCodeButton: document.getElementById('reset-code'),
        playerForm: document.getElementById('player-form'),
        playerNameInput: document.getElementById('player-name'),
        userDisplayName: document.getElementById('user-display-name'),
        profileButton: document.getElementById('profile-button'),
        highlightToggle: document.getElementById('highlight-toggle'),
        pythonConsole: document.getElementById('python-current-line'),
        navInicio: document.getElementById('nav-inicio'),
        navNiveles: document.getElementById('nav-niveles'),
        navAyuda: document.getElementById('nav-ayuda'),
        navLevelsDropdown: document.getElementById('nav-levels-dropdown')
    };
    
    const modals = {
        welcome: new bootstrap.Modal(document.getElementById('welcomeModal')),
        help: new bootstrap.Modal(document.getElementById('helpModal')),
        levels: new bootstrap.Modal(document.getElementById('levelsModal'))
    };

    // --- Core Game Logic ---
    function initializeGrid() {
        elements.gameGrid.innerHTML = '';
        for (let y = 0; y < gameState.grid.height; y++) {
            for (let x = 0; x < gameState.grid.width; x++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.innerHTML = `<span class="cell-coord">(${x},${y})</span>`;
                if (x === gameState.goalArea.x && gameState.goalArea.y.includes(y)) {
                    cell.classList.add('goal-cell');
                }
                elements.gameGrid.appendChild(cell);
            }
        }
    }
    
    function loadLevel(levelId) {
        stopExecution();
        const level = levels.find(l => l.id === levelId) || levels[0];
        gameState.currentLevel = level.id;
        gameState.moves = 0;
        gameState.player.hasBall = false;
        Object.assign(gameState.player, level.playerStart, { direction: 'right' });
        Object.assign(gameState.ball, level.ballPosition, { visible: true });
    gameState.defenses = JSON.parse(JSON.stringify(level.defenses));
    gameState.teammate = level.teammate ? { ...level.teammate } : null;
    gameState.target = level.target ? { ...level.target } : null;
    gameState.maxMoves = level.maxMoves || null;

        elements.currentLevel.textContent = level.id;
        elements.missionTitle.textContent = `Misión: ${level.title}`;
        elements.missionDescription.textContent = level.description;
        elements.movesCounter.textContent = '0';
        elements.bestScore.textContent = gameState.bestScores[level.id] || '-';
        elements.levelCompletePanel.style.display = 'none';
        
        updateGameDisplay();
    }
    
    function updateGameDisplay() {
    elements.gameGrid.querySelectorAll('.player, .ball, .defense, .teammate').forEach(el => el.remove());

        const playerEl = document.createElement('div');
        playerEl.className = 'player';
        playerEl.style.backgroundImage = `url('./personajes/personaje${gameState.player.avatarId}.png')`;
        const angle = {'right': 0, 'up': -90, 'left': 180, 'down': 90}[gameState.player.direction];
        playerEl.style.transform = `rotate(${angle}deg)`;
        elements.gameGrid.children[gameState.player.y * gameState.grid.width + gameState.player.x].appendChild(playerEl);

        if (!gameState.player.hasBall && gameState.ball.visible) {
            const ballEl = document.createElement('div');
            ballEl.className = 'ball';
            elements.gameGrid.children[gameState.ball.y * gameState.grid.width + gameState.ball.x].appendChild(ballEl);
        } else if (gameState.player.hasBall) {
            const ballEl = document.createElement('div');
            ballEl.className = 'ball in-possession';
            playerEl.appendChild(ballEl);
        }
        
        gameState.defenses.forEach(d => {
            const defenseEl = document.createElement('div');
            defenseEl.className = 'defense';
            defenseEl.style.backgroundImage = `url('./defensas/defensa${d.spriteId || 2}.png')`;
            elements.gameGrid.children[d.y * gameState.grid.width + d.x].appendChild(defenseEl);
        });

        if (gameState.teammate) {
            const mateEl = document.createElement('div');
            mateEl.className = 'teammate';
            mateEl.style.backgroundImage = `url('./personajes/personaje${gameState.teammate.spriteId || 15}.png')`;
            elements.gameGrid.children[gameState.teammate.y * gameState.grid.width + gameState.teammate.x].appendChild(mateEl);
        }

        elements.movesCounter.textContent = gameState.moves;
    }

    // --- Execution Engine ---
    const gameActions = {
        avanzar: () => {
            const { x: newX, y: newY } = gameActions.frente();
            if (gameActions.frente_despejado()) {
                gameState.player.x = newX;
                gameState.player.y = newY;
                gameState.moves++;
            } else {
                // Mensajes de bloqueo
                const out = newX < 0 || newX >= gameState.grid.width || newY < 0 || newY >= gameState.grid.height;
                const byDefense = gameState.defenses.some(d => d.x === newX && d.y === newY);
                if (out) {
                    elements.pythonConsole.textContent = 'avanzar(): No puedes salir del campo.';
                } else if (byDefense) {
                    elements.pythonConsole.textContent = 'avanzar(): Casilla ocupada por un defensor.';
                } else {
                    elements.pythonConsole.textContent = 'avanzar(): Movimiento bloqueado.';
                }
            }
        },
        girar_izquierda: () => {
            const dirs = ['right', 'up', 'left', 'down'];
            gameState.player.direction = dirs[(dirs.indexOf(gameState.player.direction) + 1) % 4];
            gameState.moves++;
        },
        recoger_balon: () => {
            if (!gameState.player.hasBall && gameState.ball.visible && gameState.player.x === gameState.ball.x && gameState.player.y === gameState.ball.y) {
                gameState.player.hasBall = true;
                gameState.moves++;
            } else {
                if (gameState.player.hasBall) {
                    elements.pythonConsole.textContent = 'recoger_balon(): Ya tienes el balón.';
                } else {
                    elements.pythonConsole.textContent = 'recoger_balon(): No hay balón en esta casilla.';
                }
            }
        },
        soltar_balon: () => {
            if (gameState.player.hasBall) {
                gameState.player.hasBall = false;
                Object.assign(gameState.ball, { x: gameState.player.x, y: gameState.player.y });
                gameState.moves++;
            }
        },
        frente: () => {
            let { x, y, direction } = gameState.player;
            if (direction === 'right') x++; else if (direction === 'left') x--;
            else if (direction === 'up') y--; else if (direction === 'down') y++;
            return {x, y};
        },
        frente_despejado: () => {
            const { x: nx, y: ny } = gameActions.frente();
            return nx >= 0 && nx < gameState.grid.width && ny >= 0 && ny < gameState.grid.height && !gameState.defenses.some(d => d.x === nx && d.y === ny);
        },
        tiene_balon: () => gameState.player.hasBall
    };

    // --- NEW PARSER AND EXECUTION LOGIC ---
    function parseCode(code) {
        const allLines = code.split('\n').map((text, i) => ({ text, num: i }));
        const userFunctions = {};

        function getIndent(line) { return line.text.match(/^\s*/)[0].length; }

        function parseBlock(linesBlock) {
            const commands = [];
            let i = 0;
            while (i < linesBlock.length) {
                const line = linesBlock[i];
                const trimmedLine = line.text.trim();
                
                if (trimmedLine === '' || trimmedLine.startsWith('#')) {
                    i++;
                    continue;
                }

                // **FOR LOOP PARSING**
                const forMatch = trimmedLine.match(/^for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+range\((\d+)\):$/);
                if (forMatch) {
                    const varName = forMatch[1];
                    const count = parseInt(forMatch[2], 10);
                    const bodyLines = [];
                    const forIndent = getIndent(line);
                    let j = i + 1;
                    while (j < linesBlock.length && getIndent(linesBlock[j]) > forIndent) {
                        bodyLines.push(linesBlock[j]);
                        j++;
                    }
                    commands.push({
                        type: 'loop',
                        count: count,
                        varName: varName,
                        body: parseBlock(bodyLines), // Recursively parse the loop's body
                        lineNum: line.num
                    });
                    i = j; // Move index past the loop body
                    continue;
                }

                commands.push({ type: 'command', text: trimmedLine, lineNum: line.num });
                i++;
            }
            return commands;
        }

        // Find function definitions
        for (let i = 0; i < allLines.length; i++) {
            const line = allLines[i];
            const defMatch = line.text.match(/^\s*def\s+([a-zA-Z0-9_]+)\s*\(\s*\):\s*$/);
            if (defMatch) {
                const funcName = defMatch[1];
                const bodyLines = [];
                const defIndent = getIndent(line);
                let j = i + 1;
                // Include subsequent lines that are either indented more than the def
                // or blank lines that may appear before the first indented line.
                while (j < allLines.length && (getIndent(allLines[j]) > defIndent || allLines[j].text.trim() === '')) {
                    bodyLines.push(allLines[j]);
                    j++;
                }
                userFunctions[funcName] = parseBlock(bodyLines);
            }
        }
        
        const mainLines = allLines.filter(line => !line.text.startsWith(' ') && !line.text.startsWith('#') && !line.text.trim().startsWith('def'));
        userFunctions['__main__'] = parseBlock(mainLines);
        
        return userFunctions;
    }
    
    function setupExecution() {
        stopExecution();
        loadLevel(gameState.currentLevel);
        const code = editor.getValue();
        const parsedFunctions = parseCode(code);
        gameState.running = true;
        gameState.stepState = {
            functions: parsedFunctions,
            callStack: [{
                type: 'context',
                name: '__main__',
                pc: 0, // program counter for commands
                commands: parsedFunctions['__main__'] || []
            }],
            lastCode: code
        };
    }

    function executeStep() {
        const state = gameState.stepState;
        if (!state || state.callStack.length === 0) {
            stopExecution(); return false;
        }
        
        let context = state.callStack[state.callStack.length - 1];

        if (context.pc >= context.commands.length) {
            state.callStack.pop();
            return executeStep(); // Context finished, continue in parent
        }
        
        const command = context.commands[context.pc];
        
        clearHighlights();
        if (gameState.highlightingEnabled) {
            editor.addLineClass(command.lineNum, 'background', 'current-line-highlight');
            gameState.lastHighlightedLine = command.lineNum;
        }
        elements.pythonConsole.textContent = command.type === 'command' ? command.text : `for i in range(${command.count}):`;

        if (command.type === 'command') {
            context.pc++;
            const callMatch = command.text.match(/^([a-zA-Z0-9_]+)\s*\(\s*\)$/);
            if (callMatch) {
                const funcName = callMatch[1];
                if (gameActions[funcName]) {
                    gameActions[funcName]();
                    updateGameDisplay();
                } else if (state.functions[funcName]) {
                    state.callStack.push({ type: 'context', name: funcName, pc: 0, commands: state.functions[funcName] });
                }
            }
        } else if (command.type === 'loop') {
            // If the loop context doesn't exist yet, create it
            if (context.loopCounter === undefined) {
                context.loopCounter = 0;
            }
            
            if (context.loopCounter < command.count) {
                context.loopCounter++;
                // Push the loop body as a new context to execute
                state.callStack.push({ type: 'context', name: `loop_iter_${context.loopCounter}`, pc: 0, commands: command.body });
            } else {
                // Loop finished, move to the next command
                delete context.loopCounter;
                context.pc++;
                return executeStep(); // Process next command immediately
            }
        }
        
        checkCompletion();
        return true;
    }

    function stopExecution() {
        gameState.running = false;
        if (gameState.stepExecution) {
            clearInterval(gameState.stepExecution);
            gameState.stepExecution = null;
        }
        clearHighlights();
        elements.pythonConsole.textContent = "";
        gameState.stepState = null;
    }

    function clearHighlights() {
        if (gameState.lastHighlightedLine !== null) {
            editor.removeLineClass(gameState.lastHighlightedLine, 'background', 'current-line-highlight');
            gameState.lastHighlightedLine = null;
        }
    }

    function checkCompletion() {
        // Objetivo por área de gol (niveles antiguos)
        if (!gameState.target && gameState.player.hasBall && gameState.player.x === gameState.goalArea.x && gameState.goalArea.y.includes(gameState.player.y)) {
            const playerEl = document.querySelector('.player');
            if(playerEl) playerEl.classList.add('celebration');
            stopExecution();
            
            const isNewBest = !gameState.bestScores[gameState.currentLevel] || gameState.moves < gameState.bestScores[gameState.currentLevel];
            if (isNewBest) {
                gameState.bestScores[gameState.currentLevel] = gameState.moves;
                localStorage.setItem('bestScores', JSON.stringify(gameState.bestScores));
            }
            elements.movesUsed.textContent = gameState.moves;
            elements.recordMoves.textContent = gameState.bestScores[gameState.currentLevel];
            elements.recordMessage.textContent = isNewBest ? "¡Nuevo Récord!" : `Tu récord es ${gameState.bestScores[gameState.currentLevel]} movimientos.`;

            setTimeout(() => { elements.levelCompletePanel.style.display = 'block'; }, 1000);
            return;
        }

        // Objetivo por entrega al compañero en un punto específico (niveles nuevos)
        if (gameState.target && !gameState.player.hasBall && gameState.ball.x === gameState.target.x && gameState.ball.y === gameState.target.y) {
            // Validar límite de movimientos si existe
            if (gameState.maxMoves && gameState.moves > gameState.maxMoves) {
                elements.pythonConsole.textContent = `Entregaste el balón, pero excediste el límite de ${gameState.maxMoves} movimientos.`;
                return;
            }

            const playerEl = document.querySelector('.player');
            if(playerEl) playerEl.classList.add('celebration');
            stopExecution();

            const isNewBest = !gameState.bestScores[gameState.currentLevel] || gameState.moves < gameState.bestScores[gameState.currentLevel];
            if (isNewBest) {
                gameState.bestScores[gameState.currentLevel] = gameState.moves;
                localStorage.setItem('bestScores', JSON.stringify(gameState.bestScores));
            }
            elements.movesUsed.textContent = gameState.moves;
            elements.recordMoves.textContent = gameState.bestScores[gameState.currentLevel];
            elements.recordMessage.textContent = isNewBest ? "¡Nuevo Récord!" : `Tu récord es ${gameState.bestScores[gameState.currentLevel]} movimientos.`;
            setTimeout(() => { elements.levelCompletePanel.style.display = 'block'; }, 1000);
        }
    }

    // --- Event Listeners ---
    elements.runButton.addEventListener('click', () => {
        setupExecution();
        gameState.stepExecution = setInterval(() => {
            if (!gameState.running || !executeStep()) {
                stopExecution();
            }
        }, 1000 / gameState.speed);
    });

    elements.stepSingleButton.addEventListener('click', () => {
        if (gameState.stepExecution) clearInterval(gameState.stepExecution);
        gameState.running = false;
        if (!gameState.stepState || gameState.stepState.lastCode !== editor.getValue()) {
            setupExecution();
        }
        executeStep();
    });

    elements.stopButton.addEventListener('click', stopExecution);
    elements.startButton.addEventListener('click', () => loadLevel(gameState.currentLevel));
    elements.speedSlider.addEventListener('input', e => { gameState.speed = parseInt(e.target.value, 10); });
    
    elements.navInicio.addEventListener('click', (e) => { e.preventDefault(); loadLevel(1); });
    elements.navAyuda.addEventListener('click', (e) => { e.preventDefault(); modals.help.show(); });
    elements.navNiveles.addEventListener('click', (e) => {
        e.preventDefault();
        const list = document.getElementById('levels-list');
        list.innerHTML = '';
        levels.forEach(level => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline-primary w-100 mb-2';
            btn.textContent = `Nivel ${level.id}: ${level.title}`;
            btn.onclick = () => {
                loadLevel(level.id);
                modals.levels.hide();
            };
            list.appendChild(btn);
        });
        modals.levels.show();
    });

    // Poblar el menú desplegable "Ir a nivel" en la barra superior
    function populateLevelsDropdown() {
        if (!elements.navLevelsDropdown) return;
        elements.navLevelsDropdown.innerHTML = '';
        levels.forEach(level => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.className = 'dropdown-item';
            a.href = '#';
            a.textContent = `Nivel ${level.id}: ${level.title}`;
            a.addEventListener('click', (ev) => { ev.preventDefault(); loadLevel(level.id); });
            li.appendChild(a);
            elements.navLevelsDropdown.appendChild(li);
        });
    }

    elements.nextLevelButton.addEventListener('click', () => {
        const nextId = gameState.currentLevel + 1;
        if (nextId <= levels.length) {
            loadLevel(nextId);
        } else {
            alert("¡Has completado todos los niveles!");
        }
    });

    elements.resetCodeButton.addEventListener('click', () => {
        editor.setValue(`# ¡Bienvenido al Nivel ${gameState.currentLevel}!\n# Misión: ${levels.find(l=>l.id===gameState.currentLevel).description}\n\n# ---- Funciones Disponibles ----\n# avanzar(), girar_izquierda(), recoger_balon(), soltar_balon()\n# frente_despejado(), tiene_balon()\n\ndef main():\n    # Escribe tu código aquí\n    \n\n\n# No modifiques la línea de abajo\nmain()`);
    });

    elements.playerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = elements.playerNameInput.value || 'Jugador';
        const avatarId = document.querySelector('.avatar-slide.selected')?.dataset.avatarId || 1;
        const playerData = { name, avatarId: parseInt(avatarId) };
        localStorage.setItem('player', JSON.stringify(playerData));
        Object.assign(gameState, { playerName: name, player: {...gameState.player, avatarId: parseInt(avatarId) }});
        elements.userDisplayName.textContent = name;
        modals.welcome.hide();
        loadLevel(gameState.currentLevel);
    });

    document.getElementById('avatar-list').addEventListener('click', (e) => {
        const slide = e.target.closest('.avatar-slide');
        if (slide) {
            document.querySelectorAll('.avatar-slide').forEach(s => s.classList.remove('selected'));
            slide.classList.add('selected');
        }
    });

    elements.profileButton.addEventListener('click', () => modals.welcome.show());
    elements.highlightToggle.addEventListener('change', () => {
        gameState.highlightingEnabled = elements.highlightToggle.checked;
        if (!gameState.highlightingEnabled) clearHighlights();
    });

    // --- Initial Load ---
    if (localStorage.getItem('player')) {
        const playerData = JSON.parse(localStorage.getItem('player'));
        gameState.playerName = playerData.name;
        gameState.player.avatarId = playerData.avatarId;
        elements.userDisplayName.textContent = playerData.name;
        gameState.bestScores = JSON.parse(localStorage.getItem('bestScores') || '{}');
        initializeGrid();
        loadLevel(gameState.currentLevel);
    } else {
        modals.welcome.show();
    }
    populateLevelsDropdown();
    document.querySelector('.avatar-slide[data-avatar-id="1"]').classList.add('selected');
});