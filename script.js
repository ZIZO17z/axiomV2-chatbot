const apiKey = 'AIzaSyD5zrNtvWz839V914eyOGQIRrZH8fAGFGA';
const chatList = document.querySelector('.chat-content');
const typingForm = document.getElementById('typingForm');
const userInput = document.getElementById('userInput');
const sendBtn = document.querySelector('.send-btn');
const chatContainer = document.getElementById('chatContainer');
const imagePreview = document.querySelector('.image-preview-container');
const previewImg = document.querySelector('.image-preview-container img');
const fileInput = document.getElementById('fileInput');
const graphInput = document.getElementById('graphInput');


let isFirstMessage = true;
let currentImageBase64 = null;
let currentImageMimeType = null;
let chartInstance = null;



let chatHistory = [
    {
        role: "user",
        parts: [{ text: `
            SYSTEM INSTRUCTIONS:
            You are the "Sci-Compute Ultimate Engine". You are a high-level scientific analysis tool, not a chatbot.
            
            DIRECTIVES:
            1. **DOMAIN:** Strictly Physics and Mathematics. Refuse all else.
            2. **VISION:** If an image is provided, analyze the math problem, diagram, or physics setup in the image and solve/explain it meticulously.
            3. **TONE:** Academic, rigorous, objective.
            4. **FORMAT:** Markdown for text. LaTeX ($...$ and $$...$$) for ALL math.
            5. **GRAPHING:** If the user asks to graph a function (e.g., "graph y=x^2"), output [[GRAPH: y=x^2]] as the first line of your response. Use standard math notation compatible with math.js.
        ` }]
    },
    {
        role: "model",
        parts: [{ text: "Engine Online. Vision System Active. Ready for input." }]
    }
];


window.onload = function() {
    initGraph();
    document.addEventListener('paste', handlePaste);
};



function handlePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
        const item = items[index];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            processFile(file);
            e.preventDefault();
            return;
        }
    }
}



function processFile(file) {
    if (!file || !file.type.startsWith('image/')) return;


    const reader = new FileReader();
    reader.onload = function(e) {
        currentImageBase64 = e.target.result.split(",")[1];
        currentImageMimeType = file.type;
        previewImg.src = e.target.result;
        imagePreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}



function initGraph() {
    const ctx = document.getElementById('miniGraph').getContext('2d');
    const xValues = Array.from({length: 40}, (_, i) => i/2 - 10);
    const yValues = xValues.map(x => x*x);

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: xValues,
            datasets: [{
                label: 'f(x)',
                data: yValues,
                borderColor: '#dfe6e9',
                pointRadius: 0,
                tension: 0.4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {legend: {display: false}},
            scales: {
                x: {
                    display: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(255, 255, 255, 0.2)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        font: {size: 10},
                    }
                },
                y: {
                    display: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(255, 255, 255, 0.2)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        font: {size: 10},
                    }
                }
            }
        }
    });
}



function updateGraph(eq) {
    if (!chartInstance) return;
    try {
        const expr = eq.split('=')[1] || eq;
        const node = math.parse(expr);
        const code = node.compile();
        const xValues = Array.from({length: 40}, (_, i) => i/2 - 10);
        const yValues = xValues.map(x => {
            try { return code.evaluate({x}); } catch { return 0; }
        });
        chartInstance.data.datasets[0].data = yValues;
        chartInstance.update();
        graphInput.value = eq;
    } catch (e) {
        console.log("Graph error: " + e.message);
    }
}



function insertMath(latex) {
    userInput.value += latex;
    userInput.focus();
}

function handleFileSelect(event) {
    processFile(event.target.files[0]);
}


function clearImage() {
    fileInput.value = '';
    currentImageBase64 = null;
    currentImageMimeType = null;
    imagePreview.style.display = 'none';
    previewImg.src = '';
}


typingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSubmission();
});


async function handleSubmission() {
    const text = userInput.value.trim();
    if (!text && !currentImageBase64) return;

    const emptyState = document.querySelector('.empty-state');
    if (isFirstMessage && emptyState) {
        emptyState.style.display = 'none';
        isFirstMessage = false;
    }

    const displayContent = currentImageBase64
        ? `<img src="data:${currentImageMimeType};base64,${currentImageBase64}" style="max-width: 200px; border-radius: 8px; margin-bottom: 10px; display: block;"> ${text}`
        : text;

    addMessage(displayContent, 'user', false);


    userInput.value = '';
    const imageToSend = currentImageBase64;
    const mimeToSend = currentImageMimeType;

    clearImage();
    setLoading(true);
    const loadingId = addLoadingIndicator();

    try {
        const response = await getGeminiResponse(text, imageToSend, mimeToSend);
        removeMessage(loadingId);
        addMessage(response, 'bot', true);
    } catch (error) {
        removeMessage(loadingId);
        addMessage('System Error: Computation failed. ' + error.message, 'bot', false);
    } finally {
        setLoading(false);
        userInput.focus();
    }
}


function fillAndSend(text) {
    userInput.value = text;
    handleSubmission();
}

function addMessage(content, sender, useTypingEffect = false) {
    let cleanContent = content;

    if (sender === 'bot' && cleanContent.includes('[[GRAPH:')) {
        const graphMatch = cleanContent.match(/\[\[GRAPH:\s*(.*?)\]\]/);
        if (graphMatch) {
            const equation = graphMatch[1];
            updateGraph(equation);
            cleanContent = cleanContent.replace(graphMatch[0], '').trim();
        }
    }


    const div = document.createElement("div");
    div.classList.add('message', sender);

    const avatarHTML = sender === 'bot'
        ? `<div class="avatar"><span class="material-symbols-outlined">face_6</span></div>`
        : `<div class="avatar"><span class="material-symbols-outlined">person</span></div>`;

    div.innerHTML = `
        ${sender === 'bot' ? avatarHTML : ''}
        <div class="message-bubble">
            <div class="content"></div>
        </div>
        ${sender === 'user' ? avatarHTML : ''}
    `;
    chatList.appendChild(div);
    const contentDiv = div.querySelector(".content");

    if (sender === 'user') {
        contentDiv.innerHTML = cleanContent;
    } else if (useTypingEffect) {
        streamText(contentDiv, cleanContent);
    } else {
        contentDiv.innerHTML = marked.parse(cleanContent);
        finalizeMessage(div, contentDiv);
    }
    scrollToBottom();
}


async function streamText(element, text) {
    const chunks = text.split(/(\s+)/);
    let currentMarkdown = "";

    for (let i = 0; i < chunks.length; i++) {
        currentMarkdown += chunks[i];
        if (i % 5 === 0) {
            element.innerHTML = marked.parse(currentMarkdown);
            scrollToBottom();
        }
        await new Promise(resolve => setTimeout(resolve, 15));
    }
    element.innerHTML = marked.parse(text);
    finalizeMessage(element.parentElement.parentElement, element);
}



function finalizeMessage(messageDiv, contentElement) {
    renderMathInElement(contentElement, {
        delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false}
        ],
        throwOnError: false
    });
    
    messageDiv.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });

    scrollToBottom();
}



function addLoadingIndicator() {
    const id = 'loading-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.classList.add('message', 'bot');
    div.innerHTML = `
        <div class="avatar"><span class="material-symbols-outlined">face_6</span></div>
        <div class="message-bubble">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>`;
    chatList.appendChild(div);
    scrollToBottom();
    return id;
}



function removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function setLoading(isLoading) {
    userInput.disabled = isLoading;
    sendBtn.disabled = isLoading;
}


function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function getGeminiResponse(userText, imageBase64, imageMime) {
    const userPart = { text: userText || "Analyze this image." };

    if (imageBase64) {
        chatHistory.push({
            role: 'user',
            parts: [
                userPart,
                { inlineData: { mimeType: imageMime, data: imageBase64 } }
            ]
        });
    } else {
        chatHistory.push({ role: 'user', parts: [userPart] });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    


    const payload = { contents: chatHistory };
    let delay = 1000;
    for (let i = 0; i < 3; i++) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(res.statusText);
            
            const data = await res.json();
            const botText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
            
            
            chatHistory.push({ role: "model", parts: [{ text: botText }] });
            return botText;
        } catch (e) {
            if (i === 2) throw e;
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
        }
    }
}