// --- SOCKET.IO CLIENT SETUP ---
const socket = io({ autoConnect: false });
const ding = new Audio('sounds/ding.mp3'); 
ding.volume = 0.2;

// --- DOM ELEMENTS ---
// Main UI
const joinSection = document.getElementById('joinSection');
const gameWrapper = document.getElementById('gameWrapper');
const startGameBtn = document.getElementById('startGameBtn');

// Chat & Logs
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message');
const messagesDiv = document.getElementById('messages');
const roundLogDiv = document.getElementById('round-log');

// Game Areas
const DECK_STACK = document.getElementById('deck-stack');
const HAND_AREA = document.getElementById('player-hand');
const TRICK_AREA = document.getElementById('trick-area');
const partnerSlotsDiv = document.getElementById('partner-slots');
const powerSuitSlot = document.getElementById('power-suit-slot');

// Bid Panel
const bidPanel = document.getElementById('bid-panel');
const highestBidderName = document.getElementById('highest-bidder-name');
const bidNumberSpan = document.getElementById('bid-number');
const bidLeftArrow = document.getElementById('bid-left-arrow');
const bidRightArrow = document.getElementById('bid-right-arrow');
const bidBtn = document.getElementById('bidBtn');
const passBtn = document.getElementById('passBtn');
const bidTurnMsg = document.getElementById('bid-turn-msg');

// Selection Modal
const selectionModal = document.getElementById('selection-modal');
const fullDeckDisplay = document.getElementById('full-deck-display');
const selectedPowerSuitSlot = document.getElementById('selected-power-suit');
const selectedPartnersDiv = document.getElementById('selected-partners');
const confirmSelectionBtn = document.getElementById('confirmSelectionBtn');
const selectionTitle = document.getElementById('selection-title');

// Status Panel
const roundScoreSpan = document.getElementById('roundScore');
const currentTurnSpan = document.getElementById('currentTurn');
const alphaScoreSpan = document.getElementById('alphaScore');
const targetBidSpan = document.getElementById('targetBid');

// NEW: Score Stack Elements (We need to insert this into the HTML, currently assumed available)
const SCORE_STACK_AREA = document.createElement('div');
SCORE_STACK_AREA.id = 'score-stack-area';
document.querySelector('.table-area').appendChild(SCORE_STACK_AREA);


// --- GAME STATE VARIABLES ---
let playerName = '';
let myHand = [];
let partnerCount = 0;
let currentBidAmount = 0;
let canBid = true;
let dealAnimationInProgress = false; 
let isTrickClearing = false; 
let isHandFanned = true; 


// --- UTILITY FUNCTIONS ---

/**
 * Helper function to normalize suit names to lowercase folder names.
 */
function getSuitFolderName(suit) {
    return suit.toLowerCase().replace('clove', 'clubs'); 
}

/**
 * Creates a standard card HTML element with both front and back sides.
 */
function createCardElement(card, isBack = true, isSmall = false) {
    const cardDiv = document.createElement('div');
    cardDiv.classList.add('card');
    if(isSmall) cardDiv.classList.add('small-selection-card');
    
    cardDiv.dataset.suit = card.suit;
    cardDiv.dataset.number = card.number;
    const suitFolder = getSuitFolderName(card.suit);

    // Front Image
    const frontImg = document.createElement('img');
    frontImg.classList.add('card-front');
    frontImg.src = `assets/cards/${suitFolder}/${card.number}.png`; 
    frontImg.alt = `${card.number} of ${card.suit}`;
    
    // Back Image
    const backImg = document.createElement('img');
    backImg.classList.add('card-back');
    backImg.src = `assets/cards/back.png`;
    backImg.alt = `Card Back`;

    cardDiv.appendChild(frontImg);
    cardDiv.appendChild(backImg);

    cardDiv.classList.add(isBack ? 'face-down' : 'face-up');
    
    return cardDiv;
}

/**
 * Creates the initial visual card stack at the deck location.
 */
function createDeckStackVisual(size) {
    DECK_STACK.innerHTML = '';
    DECK_STACK.classList.remove('hidden');

    for (let i = 0; i < size; i++) {
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('card', 'face-down', 'deck-card-visual');
        
        const offset = i * 0.05;
        cardDiv.style.transform = `translateY(-${offset}px) translateX(${offset}px)`;
        cardDiv.style.zIndex = 100 - i;
        
        const backImg = document.createElement('img');
        backImg.classList.add('card-back');
        backImg.src = `assets/cards/back.png`;
        cardDiv.appendChild(backImg);

        DECK_STACK.appendChild(cardDiv);
    }
}

/**
 * Applies the correct layout (fan or line) to the cards currently in hand.
 */
function applyHandLayout(handElements, isFanned) {
    const count = handElements.length;
    const rotationRange = isFanned ? 110 : 0; 
    const spacingUnit = 5; 
    const linearGap = 0.5; 

    handElements.forEach((cardEl, index) => {
        const angle = (index - (count - 1) / 2) * (rotationRange / count);
        
        cardEl.style.left = '50%'; 
        cardEl.style.top = '100%'; 

        if (isFanned) {
            cardEl.style.transform = `
                translateX(-50%) 
                rotate(${angle}deg) 
                translateY(calc(var(--scale) * -15))
            `;
        } else {
            const totalWidthUnits = count * (1 + linearGap) - linearGap;
            const cardCenterOffset = (index - (count - 1) / 2) * (1 + linearGap) * varToNumber('card-width-unit');
            
             cardEl.style.transform = `
                translateX(calc(-50% + var(--scale) * ${cardCenterOffset}))
                translateY(calc(var(--scale) * -11.6))
            `;
        }
        cardEl.style.zIndex = 50 + index;
    });
}

/**
 * Helper to extract number from CSS variable string.
 */
function varToNumber(cssVarName) {
    switch (cssVarName) {
        case 'card-width-unit': return 8;
        default: return 1;
    }
}


/**
 * ANIMATION: Deals cards one by one from the deck to the player's hand position.
 */
function animateDeal(hand) {
    if (dealAnimationInProgress || hand.length === 0) return;
    dealAnimationInProgress = true;
    
    HAND_AREA.innerHTML = ''; 
    createDeckStackVisual(hand.length);

    const count = hand.length;
    const startDelay = 150;
    const interval = 100;
    const rotationRange = 110; 
    
    const dealtCards = [];

    hand.forEach((cardData, index) => {
        
        setTimeout(() => {
            const visualCard = DECK_STACK.lastElementChild;
            if (visualCard) {
                DECK_STACK.removeChild(visualCard); 

                const cardEl = createCardElement(cardData, true, false); 
                cardEl.classList.remove('deck-card-visual');
                cardEl.style.transform = 'none';
                
                HAND_AREA.appendChild(cardEl);
                dealtCards.push(cardEl);

                const angle = (index - (count - 1) / 2) * (rotationRange / count);
                
                cardEl.style.left = '50%'; 
                cardEl.style.top = '100%'; 

                cardEl.style.transform = `
                    translateX(-50%) 
                    rotate(${angle}deg) 
                    translateY(calc(var(--scale) * -15))
                `;
                
                setTimeout(() => {
                    cardEl.classList.remove('face-down');
                    cardEl.classList.add('face-up');
                    
                    cardEl.addEventListener('click', () => {
                        if (window.gameState.public.stage === 'playing' && window.gameState.public.players[window.gameState.public.turnIndex] === playerName) {
                            const playedCardData = {
                                suit: cardEl.dataset.suit,
                                number: cardEl.dataset.number
                            };
                            socket.emit('cardPlayed', playedCardData);
                        }
                    });

                }, 500); 
            }
        }, startDelay + index * interval);
    });

    setTimeout(() => {
        dealAnimationInProgress = false;
        DECK_STACK.classList.add('hidden');
        applyHandLayout(dealtCards, isHandFanned);
    }, startDelay + count * interval + 600);
}

/**
 * Utility to check if a card object is in the player's current hand.
 */
function isCardInMyHand(card) {
    return myHand.some(hCard => hCard.suit === card.suit && hCard.number === card.number);
}

/**
 * Toggles the hand view between fanned and lined.
 */
function toggleHandView() {
    isHandFanned = !isHandFanned;
    const handElements = Array.from(HAND_AREA.children);
    applyHandLayout(handElements, isHandFanned);
}

/**
 * Animation for cards gathering to the trick winner.
 */
function animateTrickCollection(winner, trickScore) {
    const trickCards = Array.from(TRICK_AREA.querySelectorAll('.played-card'));
    
    // We rely on CSS to define the target area.
    trickCards.forEach((cardEl, index) => {
        const parentSlot = cardEl.parentElement;

        cardEl.style.position = 'absolute';
        
        setTimeout(() => {
            const scoreStackTargetTransformX = -280; // Approximate bottom left center X offset
            const scoreStackTargetTransformY = 100; // Approximate bottom left center Y offset
            
            cardEl.style.transition = 'transform 0.5s ease-in, opacity 0.4s';
            cardEl.style.transform = `translate(${scoreStackTargetTransformX}px, ${scoreStackTargetTransformY}px) rotate(0deg) scale(0.3)`;
            cardEl.style.opacity = '0'; // Fade out slightly
        }, index * 50);
        
        setTimeout(() => {
            if (parentSlot) TRICK_AREA.removeChild(parentSlot);
            // After all cards are gone, update the score display
            if (index === trickCards.length - 1) {
                updateScoreStackDisplay(winner, trickScore);
            }
        }, trickCards.length * 50 + 500); // 500ms after last card starts
    });
}

function updateScoreStackDisplay(winner, score) {
    
    const isPlayerWinner = winner === playerName;

    // Temporary notification in the score box
    roundScoreSpan.textContent = `+${score}`;
    currentTurnSpan.textContent = `${winner} wins!`;

    // Update the visual score stack (if the winner is THIS player)
    if (isPlayerWinner) {
        let scoreStackCard = document.getElementById('player-score-stack-card');
        if (!scoreStackCard) {
            scoreStackCard = document.createElement('div');
            scoreStackCard.id = 'player-score-stack-card';
            scoreStackCard.classList.add('trick-stack'); // Apply scoring stack CSS
            SCORE_STACK_AREA.appendChild(scoreStackCard);
        }
        
        // Update the score text
        scoreStackCard.innerHTML = `
            <span class="text-white font-bold text-lg absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                ${score} pts
            </span>
        `;
    }
}


// --- STAGE RENDERERS ---

function renderBidPanel(publicState) {
    const isMyTurn = publicState.bidders[publicState.currentBidIndex] === playerName;
    
    highestBidderName.textContent = publicState.highestBidder || 'None';
    
    const serverHighestBid = publicState.highestBid || 0;
    const clientInitialBid = serverHighestBid > 0 ? serverHighestBid + 5 : 125;
    currentBidAmount = clientInitialBid;
    
    bidNumberSpan.textContent = isMyTurn ? currentBidAmount : serverHighestBid; 
    
    bidPanel.classList.remove('hidden');
    
    if (isMyTurn && canBid) {
        bidTurnMsg.textContent = "It's your turn to bid!";
        bidBtn.disabled = currentBidAmount <= serverHighestBid;
        passBtn.disabled = false;
        bidRightArrow.disabled = false;
        bidLeftArrow.disabled = currentBidAmount === clientInitialBid;
    } else {
        bidTurnMsg.textContent = isMyTurn ? `You must bid at least ${clientInitialBid}.` : `Waiting for ${publicState.bidders[publicState.currentBidIndex]}...`;
        bidBtn.disabled = true;
        passBtn.disabled = true; 
        bidRightArrow.disabled = true;
        bidLeftArrow.disabled = true;
    }
    
    if (!canBid) {
        bidTurnMsg.textContent = "You have passed the auction.";
        bidPanel.classList.add('hidden');
    }
}

/**
 * Renders the Power Suit and Partner Selection Modal.
 */
function renderPowerSuitSelection(publicState) {
    const partnerCount = Math.ceil(publicState.playerCount / 2) - 1;
    selectedPartnersDiv.innerHTML = '';
    
    // Set up partner slots
    for(let i=0; i < partnerCount; i++){
        const slot = document.createElement('div');
        slot.classList.add('info-slot', 'small-slot', 'partner-slot');
        slot.innerHTML = `<span class="placeholder-text">Partner ${i + 1}</span>`; 
        slot.dataset.slotIndex = i;
        selectedPartnersDiv.appendChild(slot);
    }
    
    selectionModal.classList.remove('hidden');
    fullDeckDisplay.innerHTML = '';

    // --- State Management for Selection ---
    let selectedSuit = publicState.powerSuit;
    let selectedPartners = publicState.partners.slice();

    // Show current power suit (if already selected on server)
    if (selectedSuit) {
        selectedPowerSuitSlot.innerHTML = `<img src="assets/cards/${getSuitFolderName(selectedSuit)}/Ace.png" class="card-img-small"> <span class="placeholder-text">Power Suit</span>`;
        
    } else {
        selectedPowerSuitSlot.innerHTML = `<span class="placeholder-text">Power Suit</span>`;
    }
    
    // Show current partners
    document.querySelectorAll('.partner-slot').forEach(slot => slot.innerHTML = `<span class="placeholder-text">Partner</span>`);
    selectedPartners.forEach((pCard, i) => {
        const slot = document.querySelector(`.partner-slot[data-slot-index="${i}"]`);
        slot.innerHTML = `<img src="assets/cards/${getSuitFolderName(pCard.suit)}/${pCard.number}.png" class="card-img-small"> <span class="placeholder-text">Partner ${i + 1}</span>`;
    });


    // Determine current phase
    const isPowerSuitPhase = publicState.powerSuit === null;
    selectionTitle.textContent = isPowerSuitPhase ? "Select Power Suit" : "Select Partner Cards";
    confirmSelectionBtn.classList.add('hidden');

    // --- 1. Arrange Cards by Suit (Spades, Hearts, Diamonds, Clubs) ---
    const sortedDeck = publicState.defaultDeck.slice().sort((a, b) => {
        const suitsOrder = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
        return suitsOrder.indexOf(a.suit) - suitsOrder.indexOf(b.suit);
    });

    const suits = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
    
    suits.forEach(suit => {
        const suitCards = sortedDeck.filter(card => card.suit === suit);
        if (suitCards.length === 0) return;

        const suitRow = document.createElement('div');
        suitRow.classList.add('suit-row');
        
        suitCards.forEach(card => {
            const cardEl = createCardElement(card, false, true);
            
            // Gray out cards player owns OR already selected partners
            if (isCardInMyHand(card) || selectedPartners.some(p => p.suit === card.suit && p.number === card.number)) {
                cardEl.classList.add('disabled');
            }
            
            cardEl.addEventListener('click', () => {
                if (cardEl.classList.contains('disabled')) return;

                if (isPowerSuitPhase) {
                    // STAGE 1: POWER SUIT SELECTION
                    selectedSuit = card.suit;
                    
                    document.querySelectorAll('.full-deck-display .card').forEach(c => c.classList.remove('selected'));
                    document.querySelectorAll(`.full-deck-display .card[data-suit="${selectedSuit}"]`).forEach(c => c.classList.add('selected'));
                    
                    selectedPowerSuitSlot.innerHTML = `<img src="assets/cards/${getSuitFolderName(selectedSuit)}/Ace.png" class="card-img-small"> <span class="placeholder-text">Power Suit</span>`;
                    
                    confirmSelectionBtn.classList.remove('hidden');
                
                } else {
                    // STAGE 2: PARTNER SELECTION
                    const cardId = `${card.suit}_${card.number}`;
                    const partnerIndex = selectedPartners.findIndex(p => `${p.suit}_${p.number}` === cardId);

                    if (partnerIndex === -1 && selectedPartners.length < partnerCount) {
                        selectedPartners.push(card);
                        cardEl.classList.add('selected');
                    } else if (partnerIndex !== -1) {
                        selectedPartners.splice(partnerIndex, 1);
                        cardEl.classList.remove('selected');
                    }
                    
                    // Update Partner slots UI
                    document.querySelectorAll('.partner-slot').forEach(slot => slot.innerHTML = `<span class="placeholder-text">Partner</span>`);
                    selectedPartners.forEach((pCard, i) => {
                        const slot = document.querySelector(`.partner-slot[data-slot-index="${i}"]`);
                        slot.innerHTML = `<img src="assets/cards/${getSuitFolderName(pCard.suit)}/${pCard.number}.png" class="card-img-small"> <span class="placeholder-text">Partner ${i + 1}</span>`;
                    });
                    
                    confirmSelectionBtn.classList.toggle('hidden', selectedPartners.length !== partnerCount);
                }
            });
            suitRow.appendChild(cardEl);
        });
        fullDeckDisplay.appendChild(suitRow);
    });
    
    // --- 3. Confirm button logic ---
    confirmSelectionBtn.onclick = () => {
        if (isPowerSuitPhase) {
            // Send Power Suit
            if (selectedSuit) {
                socket.emit('powerSuitSelected', selectedSuit);
            }
        } 
        else {
            // Send Partners
            if (selectedPartners.length === partnerCount) {
                socket.emit('partnersSelected', selectedPartners);
                selectionModal.classList.add('hidden');
            }
        }
    };
}


// --- MAIN GAME STATE RENDERERS ---

function renderGameState(data) {
    window.gameState = data;
    const { public: pub, playerGameState: player } = data;
    
    // Check if the trick was completed in the current server state sync (Sync 1)
    const trickCompletedThisSync = data.public.roundWinner && data.public.round.length === data.public.playerCount;
    
    if (trickCompletedThisSync) {
        // State is Sync 1: Trick is complete, cards are visible. Trigger animation and pause.
        
        const winnerName = data.public.roundWinner;
        const trickScore = data.public.scoreToCollect;

        // 1. Animate trick gathering
        animateTrickCollection(winnerName, trickScore);
        
        // We rely on the server to send Sync 2 after 3.5s.
    }
    
    // Render the state, allowing Sync 1 (full trick) or Sync 2 (cleared trick) to update the visuals
    
    // NOTE: This render must run whether Sync 1 or Sync 2 occurs.
    
    myHand = player.hand;

    // 1. Common UI updates
    roundScoreSpan.textContent = pub.roundScore;
    currentTurnSpan.textContent = pub.players[pub.turnIndex] || '...';
    targetBidSpan.textContent = pub.highestBid;
    
    // 2. Control visibility
    startGameBtn.classList.add('hidden');
    bidPanel.classList.add('hidden');
    selectionModal.classList.add('hidden');
    DECK_STACK.classList.add('hidden'); 
    
    // 3. Stage-specific rendering
    if (pub.stage === 'preGame') {
        startGameBtn.classList.remove('hidden');
    }
    
    else if (pub.stage === 'dealing') {
        if (myHand.length > 0 && HAND_AREA.children.length === 0 && !dealAnimationInProgress) {
            animateDeal(myHand);
        }
        DECK_STACK.classList.remove('hidden');
    }
    
    else if (pub.stage === 'auction') {
        bidPanel.classList.remove('hidden');
        renderBidPanel(pub);
        if (myHand.length > 0 && HAND_AREA.children.length > 0 && !dealAnimationInProgress) {
             applyHandLayout(Array.from(HAND_AREA.children), isHandFanned);
        }
    }
    
    else if ((pub.stage === 'powerSuitSelection' || pub.stage === 'partnerSelection') && pub.highestBidder === playerName) {
        renderPowerSuitSelection(pub);
    }
    
    // 4. Update Trick Area
    TRICK_AREA.innerHTML = '';
    
    const handCardElements = Array.from(HAND_AREA.children);
    
    for (let i = 0; i < pub.playerCount; i++) {
        const slot = document.createElement('div');
        slot.classList.add('trick-slot');
        
        if (pub.round[i]) {
            const cardData = pub.round[i].card;
            const player = pub.round[i].playerName;
            
            // FIX 7: Card removal logic
            const playedCardEl = handCardElements.find(el => el.dataset.suit === cardData.suit && el.dataset.number === cardData.number);
            if (playedCardEl) {
                HAND_AREA.removeChild(playedCardEl);
            }
            
            // CRITICAL: Ensure card is created and marked FACE-UP when placed in the trick slot
            const cardEl = createCardElement(cardData, false, false); 
            
            cardEl.classList.remove('card'); 
            cardEl.classList.add('played-card');
            
            const nameLabel = document.createElement('span');
            nameLabel.textContent = player;
            nameLabel.classList.add('text-sm', 'absolute', 'bottom-0');
            
            slot.appendChild(cardEl);
            slot.appendChild(nameLabel);
        }
        TRICK_AREA.appendChild(slot);
    }
    
    // 5. Update Top Info Bar (Power Suit and Partners)
    powerSuitSlot.innerHTML = `<span class="placeholder-text">Power Suit</span>`;
    if (pub.powerSuit) {
        powerSuitSlot.innerHTML = `<img src="assets/cards/${getSuitFolderName(pub.powerSuit)}/Ace.png" class="card-img-small"> <span class="placeholder-text">Power Suit</span>`;
    }
    
    partnerSlotsDiv.innerHTML = '';
    const totalPartnerSlots = Math.ceil(pub.playerCount / 2) - 1;
    for(let i=0; i < totalPartnerSlots; i++){
        const slot = document.createElement('div');
        slot.classList.add('info-slot', 'small-slot');
        
        if (pub.partners[i]) {
            const card = pub.partners[i];
            slot.innerHTML = `<img src="assets/cards/${getSuitFolderName(card.suit)}/${card.number}.png" class="card-img-small"> <span class="placeholder-text">Partner ${i + 1}</span>`;
        } else {
             slot.innerHTML = `<span class="placeholder-text">Partner ${i + 1}</span>`;
        }
        partnerSlotsDiv.appendChild(slot);
    }
}


// --- EVENT LISTENERS ---

// 1. Join
document.getElementById('joinBtn').addEventListener('click', () => {
    const roomId = document.getElementById('roomId').value.trim();
    const name = document.getElementById('userName').value.trim();
    if (!roomId || !name) return;

    socket.connect();
    socket.emit('joinRoom', { roomId, name });
    playerName = name;

    joinSection.classList.add("hidden");
    gameWrapper.classList.remove("hidden");
});

// 2. Chat
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = messageInput.value.trim();
    if (!msg) return;
    socket.emit('message', msg);
    messageInput.value = '';
});

// 3. Start Game
startGameBtn.addEventListener('click', () => {
    socket.emit('gameStart');
    startGameBtn.classList.add('hidden'); 
});

// 4. Bidding Controls
bidLeftArrow.addEventListener('click', () => {
    const minBid = window.gameState.public.highestBid > 0 ? window.gameState.public.highestBid + 5 : 125;
    currentBidAmount = Math.max(currentBidAmount - 5, minBid);
    bidNumberSpan.textContent = currentBidAmount;
    bidBtn.disabled = currentBidAmount <= window.gameState.public.highestBid;
    bidLeftArrow.disabled = currentBidAmount === minBid;
});

bidRightArrow.addEventListener('click', () => {
    currentBidAmount = Math.min(currentBidAmount + 5, 250);
    bidNumberSpan.textContent = currentBidAmount;
    bidBtn.disabled = currentBidAmount <= window.gameState.public.highestBid;
    bidLeftArrow.disabled = false;
});

bidBtn.addEventListener('click', () => {
    if (currentBidAmount > window.gameState.public.highestBid) {
        socket.emit('bidPlaced', currentBidAmount);
    }
});

passBtn.addEventListener('click', () => {
    socket.emit('bidPlaced', 0);
    canBid = false;
});


// 5. Card Layout Toggle (Need to add a button in HTML later to trigger this)
document.addEventListener('keydown', (e) => {
    if (e.key === 't' || e.key === 'T') { // Use 'T' key for toggle temporarily
        toggleHandView();
    }
});


// --- SOCKET.IO EVENT HANDLERS ---

socket.on('gameStateUpdate', (data) => {
    // Check if the trick was completed in the current server state sync (Sync 1)
    const trickCompletedThisSync = data.public.roundWinner && data.public.round.length === data.public.playerCount;
    
    if (trickCompletedThisSync) {
        // State is Sync 1: Trick is complete, cards are visible. Trigger animation and pause.
        
        const winnerName = data.public.roundWinner;
        const trickScore = data.public.scoreToCollect;

        // 1. Animate trick gathering
        animateTrickCollection(winnerName, trickScore);
        
        // We rely on the server to send Sync 2 after 3.5s.
    }
    
    // Render the state, allowing Sync 1 (full trick) or Sync 2 (cleared trick) to update the visuals
    window.gameState = data;
    
    if(data.public.stage === 'auction'){
        canBid = true;
        
        const serverHighestBid = data.public.highestBid || 0;
        const clientInitialBid = serverHighestBid > 0 ? serverHighestBid + 5 : 125;
        currentBidAmount = clientInitialBid;
        
        const isMyTurn = data.public.bidders[data.public.currentBidIndex] === playerName;
        if (!isMyTurn) {
            bidNumberSpan.textContent = serverHighestBid;
        } else {
             bidNumberSpan.textContent = currentBidAmount;
        }
        
    }
    
    renderGameState(data);
});

socket.on('gameStartFailed', (msg) => {
    startGameBtn.classList.remove('hidden'); 
    roundLogDiv.innerHTML += `<p class=\"sys\" style=\"color: #ff5555;\">${msg}</p>`;
    roundLogDiv.scrollTop = roundLogDiv.scrollHeight;
});

socket.on('message', (msg) => {
    messagesDiv.innerHTML += `<p class=\"msg\">${msg}</p>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    ding.play();
});

socket.on('bulkMessage', (msgs) => {
    msgs.forEach(msg => {
        roundLogDiv.innerHTML += `<p class=\"sys\">${msg}</p>`;
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight; // Scroll main chat
    roundLogDiv.scrollTop = roundLogDiv.scrollHeight; // Scroll round log
    ding.play();
});

socket.on('connect', () => {
    messagesDiv.innerHTML += `<p class=\"sys\">Connected to server</p>`;
    document.getElementById('roomID').textContent = document.getElementById('roomId').value.trim();
    if (!window.gameState || window.gameState.public.stage === 'preGame') {
        startGameBtn.classList.remove('hidden'); 
    }
});

socket.on('disconnect', () => {
    messagesDiv.innerHTML += `<p class=\"sys\">Disconnected</p>`;
    startGameBtn.classList.add('hidden');
});