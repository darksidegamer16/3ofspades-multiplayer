// --- SOCKET.IO CLIENT SETUP ---
const socket = io({ autoConnect: false });
const ding = new Audio('sounds/ding.mp3'); 
ding.volume = 0.2;

// --- DOM ELEMENTS ---
const joinSection = document.getElementById('joinSection');
const gameWrapper = document.getElementById('gameWrapper');
const startGameBtn = document.getElementById('startGameBtn');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message');
const messagesDiv = document.getElementById('messages');
const roundLogDiv = document.getElementById('round-log');
const DECK_STACK = document.getElementById('deck-stack');
const HAND_AREA = document.getElementById('player-hand');
const TRICK_AREA = document.getElementById('trick-area');
const partnerSlotsDiv = document.getElementById('partner-slots');
const powerSuitSlot = document.getElementById('power-suit-slot');
const bidPanel = document.getElementById('bid-panel');
const highestBidderName = document.getElementById('highest-bidder-name');
const bidNumberSpan = document.getElementById('bid-number');
const bidLeftArrow = document.getElementById('bid-left-arrow');
const bidRightArrow = document.getElementById('bid-right-arrow');
const bidBtn = document.getElementById('bidBtn');
const passBtn = document.getElementById('passBtn');
const bidTurnMsg = document.getElementById('bid-turn-msg');
const selectionModal = document.getElementById('selection-modal');
const fullDeckDisplay = document.getElementById('full-deck-display');
const selectedPowerSuitSlot = document.getElementById('selected-power-suit');
const selectedPartnersDiv = document.getElementById('selected-partners');
const confirmSelectionBtn = document.getElementById('confirmSelectionBtn');
const selectionTitle = document.getElementById('selection-title');
const roundScoreSpan = document.getElementById('roundScore');
const currentTurnSpan = document.getElementById('currentTurn');
const alphaScoreSpan = document.getElementById('alphaScore');
const targetBidSpan = document.getElementById('targetBid');

const SCORE_STACK_AREA = document.createElement('div');
SCORE_STACK_AREA.id = 'score-stack-area';
if (document.querySelector('.table-area')) {
    document.querySelector('.table-area').appendChild(SCORE_STACK_AREA);
}

// --- GAME STATE VARIABLES ---
let playerName = '';
let myHand = [];
let currentBidAmount = 0;
let canBid = true;
let dealAnimationInProgress = false; 
let isHandFanned = true; 

// --- UTILITY FUNCTIONS ---

/**
 * Maps game ranks to actual filenames on GitHub.
 */
const RANK_TO_FILE = {
    'A': 'ace',
    'K': 'king',
    'Q': 'queen',
    'J': 'jack',
    'Ace': 'ace',
    'King': 'king',
    'Queen': 'queen',
    'Jack': 'jack'
};

function createCardElement(card, isBack = true, isSmall = false) {
    const cardDiv = document.createElement('div');
    cardDiv.classList.add('card');
    if(isSmall) cardDiv.classList.add('small-selection-card');
    
    cardDiv.dataset.suit = card.suit;
    cardDiv.dataset.number = card.number;
    
    // 1. Lowercase suit (Spades -> spades)
    const suitFolder = card.suit.toLowerCase();
    
    // 2. Map rank to filename (A -> ace) or use number (10 -> 10)
    const mappedRank = RANK_TO_FILE[card.number] || card.number;
    const rankFile = mappedRank.toString().toLowerCase();

    const imagePath = `assets/cards/${suitFolder}/${rankFile}.png`;

    // Create Front Image
    const frontImg = document.createElement('img');
    frontImg.classList.add('card-front');
    frontImg.src = imagePath; 
    frontImg.alt = `${card.number} of ${card.suit}`;
    
    // Fallback logic
    frontImg.onerror = function() {
        console.error("Failed to load:", this.src);
        // Try one last fallback: just the raw number/letter (e.g. A.png)
        if (this.src.indexOf(rankFile) !== -1 && rankFile !== card.number.toString().toLowerCase()) {
            this.src = `assets/cards/${suitFolder}/${card.number}.png`;
        }
    };
    
    // Create Back Image
    const backImg = document.createElement('img');
    backImg.classList.add('card-back');
    backImg.src = `assets/cards/back.png`;
    backImg.alt = `Card Back`;

    cardDiv.appendChild(frontImg);
    cardDiv.appendChild(backImg);

    cardDiv.classList.add(isBack ? 'face-down' : 'face-up');
    
    return cardDiv;
}

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

function applyHandLayout(handElements, isFanned) {
    const count = handElements.length;
    const rotationRange = isFanned ? 110 : 0; 
    const linearGap = 0.5; 
    handElements.forEach((cardEl, index) => {
        const angle = (index - (count - 1) / 2) * (rotationRange / count);
        cardEl.style.left = '50%'; 
        cardEl.style.top = '100%'; 
        if (isFanned) {
            cardEl.style.transform = `translateX(-50%) rotate(${angle}deg) translateY(calc(var(--scale) * -15))`;
        } else {
            const cardWidthUnit = 8;
            const cardCenterOffset = (index - (count - 1) / 2) * (1 + linearGap) * cardWidthUnit;
             cardEl.style.transform = `translateX(calc(-50% + var(--scale) * ${cardCenterOffset})) translateY(calc(var(--scale) * -11.6))`;
        }
        cardEl.style.zIndex = 50 + index;
    });
}

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
                cardEl.style.transform = `translateX(-50%) rotate(${angle}deg) translateY(calc(var(--scale) * -15))`;
                setTimeout(() => {
                    cardEl.classList.remove('face-down');
                    cardEl.classList.add('face-up');
                    cardEl.onclick = () => {
                        if (window.gameState.public.stage === 'playing' && window.gameState.public.players[window.gameState.public.turnIndex] === playerName) {
                            socket.emit('cardPlayed', { suit: cardEl.dataset.suit, number: cardEl.dataset.number });
                        }
                    };
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

function isCardInMyHand(card) {
    return myHand.some(hCard => hCard.suit === card.suit && hCard.number === card.number);
}

function animateTrickCollection(winner, trickScore) {
    const trickCards = Array.from(TRICK_AREA.querySelectorAll('.played-card'));
    trickCards.forEach((cardEl, index) => {
        const parentSlot = cardEl.parentElement;
        cardEl.style.position = 'absolute';
        setTimeout(() => {
            cardEl.style.transition = 'transform 0.5s ease-in, opacity 0.4s';
            cardEl.style.transform = `translate(-280px, 100px) rotate(0deg) scale(0.3)`;
            cardEl.style.opacity = '0';
        }, index * 50);
        setTimeout(() => {
            if (parentSlot) TRICK_AREA.removeChild(parentSlot);
            if (index === trickCards.length - 1) updateScoreStackDisplay(winner, trickScore);
        }, trickCards.length * 50 + 500);
    });
}

function updateScoreStackDisplay(winner, score) {
    const isPlayerWinner = winner === playerName;
    if (roundScoreSpan) roundScoreSpan.textContent = `+${score}`;
    if (currentTurnSpan) currentTurnSpan.textContent = `${winner} wins!`;
    if (isPlayerWinner) {
        let scoreStackCard = document.getElementById('player-score-stack-card');
        if (!scoreStackCard) {
            scoreStackCard = document.createElement('div');
            scoreStackCard.id = 'player-score-stack-card';
            scoreStackCard.classList.add('trick-stack');
            if (SCORE_STACK_AREA) SCORE_STACK_AREA.appendChild(scoreStackCard);
        }
        scoreStackCard.innerHTML = `<span class="text-white font-bold text-lg absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">${score} pts</span>`;
    }
}

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
    if (!canBid) bidPanel.classList.add('hidden');
}

function renderPowerSuitSelection(publicState) {
    const partnerCountLimit = Math.ceil(publicState.playerCount / 2) - 1;
    selectedPartnersDiv.innerHTML = '';
    for(let i=0; i < partnerCountLimit; i++){
        const slot = document.createElement('div');
        slot.classList.add('info-slot', 'small-slot', 'partner-slot');
        slot.innerHTML = `<span class="placeholder-text">Partner ${i + 1}</span>`; 
        slot.dataset.slotIndex = i;
        selectedPartnersDiv.appendChild(slot);
    }
    selectionModal.classList.remove('hidden');
    fullDeckDisplay.innerHTML = '';
    let selectedSuit = publicState.powerSuit;
    let selectedPartners = publicState.partners.slice();
    if (selectedSuit) {
        selectedPowerSuitSlot.innerHTML = `<img src="assets/cards/${selectedSuit.toLowerCase()}/ace.png" class="card-img-small"> <span class="placeholder-text">Power Suit</span>`;
    }
    const sortedDeck = publicState.defaultDeck.slice().sort((a, b) => {
        const suitsOrder = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
        return suitsOrder.indexOf(a.suit) - suitsOrder.indexOf(b.suit);
    });
    const isPowerSuitPhase = publicState.powerSuit === null;
    selectionTitle.textContent = isPowerSuitPhase ? "Select Power Suit" : "Select Partner Cards";
    confirmSelectionBtn.classList.add('hidden');
    ['Spades', 'Hearts', 'Diamonds', 'Clubs'].forEach(suit => {
        const suitCards = sortedDeck.filter(card => card.suit === suit);
        if (suitCards.length === 0) return;
        const suitRow = document.createElement('div');
        suitRow.classList.add('suit-row');
        suitCards.forEach(card => {
            const cardEl = createCardElement(card, false, true);
            if (isCardInMyHand(card) || selectedPartners.some(p => p.suit === card.suit && p.number === card.number)) cardEl.classList.add('disabled');
            cardEl.onclick = () => {
                if (cardEl.classList.contains('disabled')) return;
                if (isPowerSuitPhase) {
                    selectedSuit = card.suit;
                    document.querySelectorAll('.full-deck-display .card').forEach(c => c.classList.remove('selected'));
                    document.querySelectorAll(`.full-deck-display .card[data-suit="${selectedSuit}"]`).forEach(c => c.classList.add('selected'));
                    selectedPowerSuitSlot.innerHTML = `<img src="assets/cards/${selectedSuit.toLowerCase()}/ace.png" class="card-img-small"> <span class="placeholder-text">Power Suit</span>`;
                    confirmSelectionBtn.classList.remove('hidden');
                } else {
                    const cardId = `${card.suit}_${card.number}`;
                    const pIdx = selectedPartners.findIndex(p => `${p.suit}_${p.number}` === cardId);
                    if (pIdx === -1 && selectedPartners.length < partnerCountLimit) {
                        selectedPartners.push(card);
                        cardEl.classList.add('selected');
                    } else if (pIdx !== -1) {
                        selectedPartners.splice(pIdx, 1);
                        cardEl.classList.remove('selected');
                    }
                    document.querySelectorAll('.partner-slot').forEach(slot => slot.innerHTML = `<span class="placeholder-text">Partner</span>`);
                    selectedPartners.forEach((pCard, i) => {
                        const slot = document.querySelector(`.partner-slot[data-slot-index="${i}"]`);
                        const rankForImg = RANK_TO_FILE[pCard.number] || pCard.number;
                        slot.innerHTML = `<img src="assets/cards/${pCard.suit.toLowerCase()}/${rankForImg.toString().toLowerCase()}.png" class="card-img-small"> <span class="placeholder-text">Partner ${i + 1}</span>`;
                    });
                    confirmSelectionBtn.classList.toggle('hidden', selectedPartners.length !== partnerCountLimit);
                }
            };
            suitRow.appendChild(cardEl);
        });
        fullDeckDisplay.appendChild(suitRow);
    });
    confirmSelectionBtn.onclick = () => {
        if (isPowerSuitPhase && selectedSuit) socket.emit('powerSuitSelected', selectedSuit);
        else if (selectedPartners.length === partnerCountLimit) {
            socket.emit('partnersSelected', selectedPartners);
            selectionModal.classList.add('hidden');
        }
    };
}

function renderGameState(data) {
    window.gameState = data;
    const { public: pub, playerGameState: player } = data;
    if (data.public.roundWinner && data.public.round.length === data.public.playerCount) animateTrickCollection(data.public.roundWinner, data.public.scoreToCollect);
    myHand = player.hand;
    if (roundScoreSpan) roundScoreSpan.textContent = pub.roundScore;
    if (currentTurnSpan) currentTurnSpan.textContent = pub.players[pub.turnIndex] || '...';
    if (targetBidSpan) targetBidSpan.textContent = pub.highestBid;
    startGameBtn.classList.add('hidden');
    bidPanel.classList.add('hidden');
    selectionModal.classList.add('hidden');
    if (pub.stage === 'preGame') startGameBtn.classList.remove('hidden');
    else if (pub.stage === 'dealing') { if (myHand.length > 0 && HAND_AREA.children.length === 0 && !dealAnimationInProgress) animateDeal(myHand); }
    else if (pub.stage === 'auction') renderBidPanel(pub);
    else if ((pub.stage === 'powerSuitSelection' || pub.stage === 'partnerSelection') && pub.highestBidder === playerName) renderPowerSuitSelection(pub);
    TRICK_AREA.innerHTML = '';
    for (let i = 0; i < pub.playerCount; i++) {
        const slot = document.createElement('div');
        slot.classList.add('trick-slot');
        if (pub.round[i]) {
            const cardEl = createCardElement(pub.round[i].card, false, false); 
            cardEl.classList.remove('card'); cardEl.classList.add('played-card');
            const nameLabel = document.createElement('span');
            nameLabel.textContent = pub.round[i].playerName;
            nameLabel.classList.add('text-sm', 'absolute', 'bottom-0');
            slot.appendChild(cardEl); slot.appendChild(nameLabel);
        }
        TRICK_AREA.appendChild(slot);
    }
    powerSuitSlot.innerHTML = `<span class="placeholder-text">Power Suit</span>`;
    if (pub.powerSuit) {
        powerSuitSlot.innerHTML = `<img src="assets/cards/${pub.powerSuit.toLowerCase()}/ace.png" class="card-img-small"> <span class="placeholder-text">Power Suit</span>`;
    }
    partnerSlotsDiv.innerHTML = '';
    const totalPartnerSlots = Math.ceil(pub.playerCount / 2) - 1;
    for(let i=0; i < totalPartnerSlots; i++){
        const slot = document.createElement('div');
        slot.classList.add('info-slot', 'small-slot');
        if (pub.partners[i]) {
            const card = pub.partners[i];
            const rankForImg = RANK_TO_FILE[card.number] || card.number;
            slot.innerHTML = `<img src="assets/cards/${card.suit.toLowerCase()}/${rankForImg.toString().toLowerCase()}.png" class="card-img-small"> <span class="placeholder-text">Partner ${i + 1}</span>`;
        } else slot.innerHTML = `<span class="placeholder-text">Partner ${i + 1}</span>`;
        partnerSlotsDiv.appendChild(slot);
    }
}

document.getElementById('joinBtn').onclick = () => {
    const roomIdInput = document.getElementById('roomId');
    const userNameInput = document.getElementById('userName');
    const roomId = roomIdInput.value.trim();
    const name = userNameInput.value.trim();
    if (!roomId || !name) return;
    socket.connect();
    socket.emit('joinRoom', { roomId, name });
    playerName = name;
    joinSection.classList.add("hidden");
    gameWrapper.classList.remove("hidden");
};

chatForm.onsubmit = (e) => {
    e.preventDefault();
    const msg = messageInput.value.trim();
    if (!msg) return;
    socket.emit('message', msg);
    messageInput.value = '';
};

startGameBtn.onclick = () => socket.emit('gameStart');

bidLeftArrow.onclick = () => {
    const minBid = window.gameState.public.highestBid > 0 ? window.gameState.public.highestBid + 5 : 125;
    currentBidAmount = Math.max(currentBidAmount - 5, minBid);
    bidNumberSpan.textContent = currentBidAmount;
    bidBtn.disabled = currentBidAmount <= window.gameState.public.highestBid;
    bidLeftArrow.disabled = currentBidAmount === minBid;
};

bidRightArrow.onclick = () => {
    currentBidAmount = Math.min(currentBidAmount + 5, 250);
    bidNumberSpan.textContent = currentBidAmount;
    bidBtn.disabled = currentBidAmount <= window.gameState.public.highestBid;
    bidLeftArrow.disabled = false;
};

bidBtn.onclick = () => { if (currentBidAmount > window.gameState.public.highestBid) socket.emit('bidPlaced', currentBidAmount); };
passBtn.onclick = () => { socket.emit('bidPlaced', 0); canBid = false; };

socket.on('gameStateUpdate', (data) => renderGameState(data));
socket.on('gameStartFailed', (msg) => {
    startGameBtn.classList.remove('hidden'); 
    roundLogDiv.innerHTML += `<p class="sys" style="color: #ff5555;">${msg}</p>`;
    roundLogDiv.scrollTop = roundLogDiv.scrollHeight;
});
socket.on('message', (msg) => {
    messagesDiv.innerHTML += `<p class="msg">${msg}</p>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    ding.play();
});
socket.on('bulkMessage', (msgs) => {
    msgs.forEach(msg => { roundLogDiv.innerHTML += `<p class="sys">${msg}</p>`; });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    roundLogDiv.scrollTop = roundLogDiv.scrollHeight;
    ding.play();
});
socket.on('connect', () => {
    messagesDiv.innerHTML += `<p class="sys">Connected to server</p>`;
    if (!window.gameState || window.gameState.public.stage === 'preGame') startGameBtn.classList.remove('hidden'); 
});
socket.on('disconnect', () => {
    messagesDiv.innerHTML += `<p class="sys">Disconnected</p>`;
    startGameBtn.classList.add('hidden');
});
