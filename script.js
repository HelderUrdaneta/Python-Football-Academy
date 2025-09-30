document.addEventListener('DOMContentLoaded', function() {
    // Preload images function
    function preloadImages() {
        // Preload avatars
        for (let i = 1; i <= 18; i++) {
            const img = new Image();
            img.src = `./personajes/personaje${i}.png`;
        }
        
        // Preload defenses
        for (let i = 1; i <= 10; i++) {
            const img = new Image();
            img.src = `./defensas/defensa${i}.png`;
        }
        
        // Preload ball and field
        const ball = new Image();
        ball.src = './campo/balon.png';
        
        const field = new Image();
        field.src = './campo/campo.png';
    }
    
    // Call preload function
    preloadImages();
    
    // Initialize CodeMirror
    const editor = CodeMirror.fromTextArea(document.getElementById('code-editor'), {
        mode: 'python',
        theme: 'monokai',
        lineNumbers: true,
        indentUnit: 4,
        autoCloseBrackets: true,
        matchBrackets: true
    });

    // Initialize Splide carousel for avatar selection
    const avatarList = document.getElementById('avatar-list');
    for (let i = 1; i <= 18; i++) {
        const slide = document.createElement('li');
        slide.className = 'splide__slide';
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'avatar-slide';
        avatarDiv.dataset.avatarId = i;
        
        const img = document.createElement('img');
        img.src = `./personajes/personaje${i}.png`;
        img.className = 'avatar-img';
        img.alt = `Personaje ${i}`;
        
        const span = document.createElement('span');
        span.textContent = `Personaje ${i}`;
        
        avatarDiv.appendChild(img);
        avatarDiv.appendChild(span);
        slide.appendChild(avatarDiv);
        avatarList.appendChild(slide);
    }
    
    new Splide('#avatar-carousel', {
        perPage: 3,
        gap: 10,
        pagination: false,
        arrows: true,
        breakpoints: { 768: { perPage: 2 }, 576: { perPage: 1 } }
    }).mount();

    // Global game state
    const gameState = {
        player: { x: 0, y: 0, direction: 'right', hasBall: false, avatarId: 1 },
        ball: { x: 2, y: 4, visible: true },
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
        stepState: null, // Holds state for step-by-step execution
        highlightingEnabled: true
    };
    


    // Level configurations
    const levels = [
        { id: 1, title: "Tutorial: Recoge el balón", description: "Recoge el balón y llévalo hasta la portería.", playerStart: { x: 0, y: 4 }, ballPosition: { x: 2, y: 4 }, defenses: [], defenseSprite: 1, bestScore: 6 },
        { id: 2, title: "Esquiva al defensor", description: "Hay un defensor bloqueando el camino directo. Busca una ruta alternativa.", playerStart: { x: 0, y: 3 }, ballPosition: { x: 1, y: 3 }, defenses: [{ x: 4, y: 3, spriteId: 2 }], defenseSprite: 2, bestScore: 10 },
        { id: 3, title: "Pasa el balón", description: "Recoge el balón y déjalo en el centro del campo (5,4).", playerStart: { x: 0, y: 2 }, ballPosition: { x: 1, y: 2 }, defenses: [{ x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 }], targetPosition: { x: 5, y: 4 }, bestScore: 12 }
    ];

    // DOM elements
    const gameGrid = document.getElementById('game-grid');
    const movesCounter = document.getElementById('moves-counter');
    const currentLevelElement = document.getElementById('current-level');
    const bestScoreElement = document.getElementById('best-score');
    const missionTitle = document.getElementById('mission-title');
    const missionDescription = document.getElementById('mission-description');
    const runButton = document.getElementById('run-button');
    const startButton = document.getElementById('start-button');
    const stepButton = document.getElementById('step-button');
    const stepSingleButton = document.getElementById('step-single-button');
    const stopButton = document.getElementById('stop-button');
    const speedSlider = document.getElementById('speed-slider');
    const levelCompletePanel = document.getElementById('level-complete');
    const movesUsedElement = document.getElementById('moves-used');
    const recordMovesElement = document.getElementById('record-moves');
    const betterPossibleElement = document.getElementById('better-possible');
    const nextLevelButton = document.getElementById('next-level');
    const resetCodeButton = document.getElementById('reset-code');
    const playerForm = document.getElementById('player-form');
    const playerNameInput = document.getElementById('player-name');
    const userDisplayName = document.getElementById('user-display-name');
    const profileButton = document.getElementById('profile-button');
    const welcomeModal = new bootstrap.Modal(document.getElementById('welcomeModal'));
    const helpButton = document.getElementById('help-button');
    const helpModal = new bootstrap.Modal(document.getElementById('helpModal'));
    const optimizeButton = document.getElementById('optimize-button');
    const highlightToggle = document.getElementById('highlight-toggle');

    // Load player data or show welcome modal
    if (!localStorage.getItem('player')) {
        welcomeModal.show();
    } else {
        const playerData = JSON.parse(localStorage.getItem('player'));
        gameState.playerName = playerData.name;
        gameState.player.avatarId = playerData.avatarId;
        userDisplayName.textContent = playerData.name;
        if (localStorage.getItem('bestScores')) {
            gameState.bestScores = JSON.parse(localStorage.getItem('bestScores'));
        }
    }
    
    function initializeGrid() {
        gameGrid.innerHTML = '';
        for (let y = 0; y < gameState.grid.height; y++) {
            for (let x = 0; x < gameState.grid.width; x++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.dataset.x = x;
                cell.dataset.y = y;
                const coord = document.createElement('span');
                coord.className = 'cell-coord';
                coord.textContent = `(${x},${y})`;
                cell.appendChild(coord);
                if (x === gameState.goalArea.x && gameState.goalArea.y.includes(y)) {
                    cell.classList.add('goal-cell');
                }
                gameGrid.appendChild(cell);
            }
        }
    }
    
    function loadLevel(levelId) {
        stopExecution(); // Stop any ongoing execution
        gameState.moves = 0;
        gameState.player.hasBall = false;
        const level = levels.find(l => l.id === levelId) || levels[0];
        gameState.currentLevel = level.id;
        currentLevelElement.textContent = level.id;
        missionTitle.textContent = `Misión: ${level.title}`;
        missionDescription.textContent = level.description;
        movesCounter.textContent = '0';
        bestScoreElement.textContent = gameState.bestScores[level.id] || '-';
        gameState.player.x = level.playerStart.x;
        gameState.player.y = level.playerStart.y;
        gameState.player.direction = 'right';
        gameState.ball.x = level.ballPosition.x;
        gameState.ball.y = level.ballPosition.y;
        gameState.ball.visible = true;
        gameState.defenses = [...level.defenses];
        updateGameDisplay();
        levelCompletePanel.style.display = 'none';
    }
    
    function updateGameDisplay() {
        document.querySelectorAll('.player, .ball, .defense').forEach(el => el.remove());
        
        // Place player
        const playerCell = document.querySelector(`.grid-cell[data-x="${gameState.player.x}"][data-y="${gameState.player.y}"]`);
        if (playerCell) {
            const playerEl = document.createElement('div');
            playerEl.className = 'player';
            playerEl.style.backgroundImage = `url('./personajes/personaje${gameState.player.avatarId}.png')`;
            let angle = 0;
            if (gameState.player.direction === 'up') angle = -90;
            if (gameState.player.direction === 'left') angle = 180;
            if (gameState.player.direction === 'down') angle = 90;
            playerEl.style.transform = `rotate(${angle}deg)`;
            playerCell.appendChild(playerEl);

            if (gameState.player.hasBall) {
                const ballEl = document.createElement('div');
                ballEl.className = 'ball in-possession'; // Use new class for positioning
                playerEl.appendChild(ballEl);
            }
        }
        
        if (!gameState.player.hasBall && gameState.ball.visible) {
            const ballCell = document.querySelector(`.grid-cell[data-x="${gameState.ball.x}"][data-y="${gameState.ball.y}"]`);
            if (ballCell) {
                const ballEl = document.createElement('div');
                ballEl.className = 'ball';
                ballCell.appendChild(ballEl);
            }
        }
        
        const currentLevel = levels.find(l => l.id === gameState.currentLevel);
        const defaultDefenseSprite = currentLevel?.defenseSprite || 1;
        gameState.defenses.forEach(defense => {
            const defenseCell = document.querySelector(`.grid-cell[data-x="${defense.x}"][data-y="${defense.y}"]`);
            if (defenseCell) {
                const defenseEl = document.createElement('div');
                defenseEl.className = 'defense';
                const spriteId = defense.spriteId || defaultDefenseSprite;
                defenseEl.style.backgroundImage = `url('./defensas/defensa${spriteId}.png')`;
                defenseCell.appendChild(defenseEl);
            }
        });
        
        movesCounter.textContent = gameState.moves;
    }

    // Central function to stop any execution
    function stopExecution() {
        gameState.running = false;
        if (gameState.stepExecution) {
            clearInterval(gameState.stepExecution);
            gameState.stepExecution = null;
        }
        // Clear highlights and reset step state
        editor.operation(() => editor.getAllMarks().forEach(m => m.clear()));
        const pythonConsole = document.getElementById('python-current-line');
        if (pythonConsole) pythonConsole.textContent = '';
        gameState.stepState = null;
    }
    
    // Game actions object
    const gameActions = {
        avanzar: function() {
            let { x: newX, y: newY } = gameState.player;
            if (gameState.player.direction === 'right') newX++;
            else if (gameState.player.direction === 'left') newX--;
            else if (gameState.player.direction === 'up') newY--;
            else if (gameState.player.direction === 'down') newY++;
            
            if (newX >= 0 && newX < gameState.grid.width && newY >= 0 && newY < gameState.grid.height && !gameState.defenses.some(d => d.x === newX && d.y === newY)) {
                gameState.player.x = newX;
                gameState.player.y = newY;
                gameState.moves++;
                updateGameDisplay();
                checkCompletion();
            }
        },
        girar_izquierda: function() {
            const directions = ['right', 'up', 'left', 'down'];
            const currentIndex = directions.indexOf(gameState.player.direction);
            gameState.player.direction = directions[(currentIndex + 1) % 4];
            gameState.moves++;
            updateGameDisplay();
        },
        recoger_balon: function() {
            if (!gameState.player.hasBall && gameState.ball.visible && gameState.player.x === gameState.ball.x && gameState.player.y === gameState.ball.y) {
                gameState.player.hasBall = true;
                gameState.ball.visible = false;
                gameState.moves++;
                updateGameDisplay();
            }
        },
        soltar_balon: function() {
            if (gameState.player.hasBall) {
                gameState.player.hasBall = false;
                gameState.ball.visible = true;
                gameState.ball.x = gameState.player.x;
                gameState.ball.y = gameState.player.y;
                gameState.moves++;
                updateGameDisplay();
                checkCompletion();
            }
        },
        prepararStepByStep: function(code) {
            const lines = code.split('\n');
            const userFunctions = {};
            let currentFunc = null, currentIndent = null;
            
            lines.forEach((rawLine, i) => {
                const line = rawLine.trim();
                const indent = rawLine.match(/^\s*/)[0].length;
                if (/^def\s+(\w+)\s*\(.*\)\s*:\s*$/.test(line)) {
                    currentFunc = line.match(/^def\s+(\w+)\s*\(.*\)\s*:\s*$/)[1];
                    currentIndent = indent;
                    userFunctions[currentFunc] = [];
                } else if (currentFunc && indent > currentIndent) {
                    userFunctions[currentFunc].push({ line: rawLine, lineNumber: i });
                } else {
                    currentFunc = null; currentIndent = null;
                }
            });
            
            const mainCommands = [];
            let insideFunction = false, functionIndent = null;
            lines.forEach((rawLine, i) => {
                const line = rawLine.trim();
                const indent = rawLine.match(/^\s*/)[0].length;
                if (/^def\s+/.test(line)) {
                    insideFunction = true;
                    functionIndent = indent;
                } else if (insideFunction && indent <= functionIndent) {
                    insideFunction = false;
                }
                if (!insideFunction && line !== '' && !line.startsWith('#')) {
                    mainCommands.push({ line, lineNumber: i });
                }
            });

            const commands = [], lineMap = [];
            const flattenActions = (bloque) => {
                for (const { line: rawLine, lineNumber: ln } of bloque) {
                    const l = rawLine.trim();
                    if (l === '' || l.startsWith('#')) continue;
                    
                    if (l.includes('avanzar()')) { commands.push(this.avanzar); lineMap.push(ln); }
                    else if (l.includes('girar_izquierda()')) { commands.push(this.girar_izquierda); lineMap.push(ln); }
                    else if (l.includes('recoger_balon()')) { commands.push(this.recoger_balon); lineMap.push(ln); }
                    else if (l.includes('soltar_balon()')) { commands.push(this.soltar_balon); lineMap.push(ln); }
                    else if (l.includes('girar_derecha()')) {
                        if (userFunctions['girar_derecha']) { flattenActions(userFunctions['girar_derecha']); }
                        else {
                            for(let i=0; i<3; i++) {
                                commands.push(this.girar_izquierda); lineMap.push(ln);
                            }
                        }
                    } else if (/^(\w+)\(\)/.test(l)) {
                        const funcName = l.match(/^(\w+)\(\)/)[1];
                        if (userFunctions[funcName]) {
                            flattenActions(userFunctions[funcName]);
                        }
                    }
                }
            };
            
            flattenActions(mainCommands);
            return { commands, lineMap, codeLines: lines };
        }
    };
    
    function checkCompletion() {
        const level = levels.find(l => l.id === gameState.currentLevel);
        const isGoal = gameState.player.hasBall && gameState.player.x === gameState.goalArea.x && gameState.goalArea.y.includes(gameState.player.y);
        const isTarget = level.targetPosition && (
            (gameState.player.hasBall && gameState.player.x === level.targetPosition.x && gameState.player.y === level.targetPosition.y) ||
            (!gameState.player.hasBall && gameState.ball.x === level.targetPosition.x && gameState.ball.y === level.targetPosition.y)
        );

        if (isGoal || isTarget) {
            completeLevel();
        }
    }

    function completeLevel() {
        stopExecution();
        const playerEl = document.querySelector('.player');
        if (playerEl) playerEl.classList.add('celebration');
        
        if (!gameState.bestScores[gameState.currentLevel] || gameState.moves < gameState.bestScores[gameState.currentLevel]) {
            gameState.bestScores[gameState.currentLevel] = gameState.moves;
            localStorage.setItem('bestScores', JSON.stringify(gameState.bestScores));
        }
        
        movesUsedElement.textContent = gameState.moves;
        recordMovesElement.textContent = gameState.bestScores[gameState.currentLevel];
        const currentLevel = levels.find(l => l.id === gameState.currentLevel);
        betterPossibleElement.style.display = (gameState.moves <= currentLevel.bestScore) ? 'none' : 'block';
        
        setTimeout(() => { levelCompletePanel.style.display = 'block'; }, 1000);
    }
    
    function executeStep() {
    if (!gameState.stepState || gameState.stepState.index >= gameState.stepState.commands.length) {
        stopExecution();
        checkCompletion();
        return false;
    }

    const step = gameState.stepState;
    const lineNumber = step.lineMap[step.index];
    const pythonConsole = document.getElementById('python-current-line');
    
    // ** MODIFICACIÓN AQUÍ: Añade el if **
    if (gameState.highlightingEnabled) {
        editor.operation(() => {
            editor.getAllMarks().forEach(m => m.clear());
            if (typeof lineNumber === 'number') {
                editor.addLineClass(lineNumber, 'background', 'current-line-highlight');
                pythonConsole.textContent = step.codeLines[lineNumber].trim();
            } else {
                pythonConsole.textContent = '';
            }
        });
    } else { // Si está desactivado, solo actualiza la consola sin resaltar
        if (typeof lineNumber === 'number') {
            pythonConsole.textContent = step.codeLines[lineNumber].trim();
        } else {
            pythonConsole.textContent = '';
        }
    }
    
    step.commands[step.index]();
    step.index++;
    return true;
}


    // Event Listeners
    runButton.addEventListener('click', () => {
        stopExecution();
        loadLevel(gameState.currentLevel);
        gameState.running = true;
        const code = editor.getValue();
        const { commands, lineMap, codeLines } = gameActions.prepararStepByStep(code);
        
        gameState.stepState = { commands, lineMap, codeLines, index: 0, lastCode: code };
        
        gameState.stepExecution = setInterval(() => {
            if (!executeStep()) {
                stopExecution();
            }
        }, 1000 / gameState.speed);
    });

    startButton.addEventListener('click', () => {
        stopExecution();
        loadLevel(gameState.currentLevel);
    });
    
    stepButton.addEventListener('click', () => { // "Paso a Paso"
        stopExecution();
        loadLevel(gameState.currentLevel);
        gameState.running = true;
        const code = editor.getValue();
        gameState.stepState = gameActions.prepararStepByStep(code);
        gameState.stepState.index = 0;
        
        gameState.stepExecution = setInterval(() => {
            if (!executeStep()) {
                stopExecution();
            }
        }, 1000 / gameState.speed);
    });
    
    stepSingleButton.addEventListener('click', () => { // "Ejecutar Siguiente"
        if (gameState.stepExecution) clearInterval(gameState.stepExecution);
        gameState.running = false;

        const code = editor.getValue();
        if (!gameState.stepState || gameState.stepState.lastCode !== code) {
            loadLevel(gameState.currentLevel);
            gameState.stepState = gameActions.prepararStepByStep(code);
            gameState.stepState.index = 0;
            gameState.stepState.lastCode = code;
        }
        executeStep();
    });

    stopButton.addEventListener('click', stopExecution);
    
    speedSlider.addEventListener('input', (e) => { gameState.speed = parseInt(e.target.value); });
    
    nextLevelButton.addEventListener('click', () => {
        const nextLevelId = gameState.currentLevel + 1;
        if (nextLevelId <= levels.length) {
            loadLevel(nextLevelId);
        } else {
            alert("¡Has completado todos los niveles disponibles!");
        }
    });
    
    resetCodeButton.addEventListener('click', () => {
        if (confirm("¿Estás seguro de reiniciar el código? Perderás todos los cambios.")) {
            editor.setValue(`# Usa estas funciones para mover al jugador:\n# avanzar() - Mueve al jugador una casilla en la dirección que mira\n# girar_izquierda() - Gira al jugador 90 grados a la izquierda\n# recoger_balon() - Recoge el balón si está en la misma casilla\n# soltar_balon() - Suelta el balón en la casilla actual\n\n# Puedes crear tus propias funciones, como esta:\ndef girar_derecha():\n    girar_izquierda()\n    girar_izquierda()\n    girar_izquierda()\n\n# Función principal - Todo comienza aquí\ndef main():\n    avanzar()\n    avanzar()\n    recoger_balon()\n    girar_derecha()\n    avanzar()\n    soltar_balon()\n\n# Llamada a la función principal\nmain()`);
        }
    });
    
    playerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const playerName = playerNameInput.value || 'Jugador';
        const selectedAvatarEl = document.querySelector('.avatar-slide.selected');
        const avatarId = selectedAvatarEl ? parseInt(selectedAvatarEl.dataset.avatarId) : 1;
        
        const playerData = { name: playerName, avatarId: avatarId };
        localStorage.setItem('player', JSON.stringify(playerData));
        
        gameState.playerName = playerName;
        gameState.player.avatarId = avatarId;
        userDisplayName.textContent = playerName;
        
        welcomeModal.hide();
        loadLevel(gameState.currentLevel);
    });
    
    document.querySelectorAll('.avatar-slide').forEach(slide => {
        slide.addEventListener('click', () => {
            document.querySelectorAll('.avatar-slide').forEach(s => s.classList.remove('selected'));
            slide.classList.add('selected');
        });
    });

    profileButton.addEventListener('click', () => welcomeModal.show());
    helpButton.addEventListener('click', () => helpModal.show());
   
        highlightToggle.addEventListener('input', () => {
        gameState.highlightingEnabled = highlightToggle.checked;
        if (!highlightToggle.checked) {
            // Si se desactiva, limpia cualquier resaltado existente
            editor.operation(() => editor.getAllMarks().forEach(m => m.clear()));
        }
    });
    
    document.querySelector('.avatar-slide[data-avatar-id="1"]').classList.add('selected');
    
    // Initialize game
    initializeGrid();
    loadLevel(gameState.currentLevel);
   
    optimizeButton.addEventListener('click', async () => {
        if (gameState.running) return;
        const code = editor.getValue();
        const level = gameState.currentLevel;
        try {
            const resp = await fetch('https://magicloops.dev/api/loop/b594c94d-6ede-4b56-b321-a062fa8dd301/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, level })
            });
            const result = await resp.json();
            alert(`Original Moves: ${result.originalMoves}\nOptimized Moves: ${result.optimizedMoves}\n\nSugerencias:\n- ${result.suggestions.join('\n- ')}`);
        } catch (err) {
            console.error('Error al llamar a MoveOptimizer:', err);
            alert('No se pudo obtener optimización. Revisa la consola.');
        }
    });
});