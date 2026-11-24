const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const messages = document.getElementById("messages");
const status = document.getElementById("status");

const chatHistory = [];

function addMessage(text, role) {
    const element = document.createElement("div");
    element.className = `message ${role}`;
    element.textContent = text;
    messages.appendChild(element);
    messages.scrollTop = messages.scrollHeight;
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = input.value.trim();
    if (!message) return;

    addMessage(message, "user");
    input.value = "";
    status.textContent = "Nuzlocke Mate is thinking...";

    const button = form.querySelector("button");
    button.disabled = true;

    chatHistory.push({
        role: "user",
        content: message
    });

    try {
        const response = await fetch("/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ messages: chatHistory })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Something went wrong.");
        }

        const reply = data.message?.content ?? data.reply;

        if (typeof reply !== "string" || !reply.trim()) {
            console.error("Leeg of ongeldig AI-antwoord:", data);
            throw new Error(
                "Nuzlocke Mate gaf geen antwoordtekst terug. Controleer de backend."
            );
        }

        addMessage(reply, "assistant");
        chatHistory.push({
            role: "assistant",
            content: reply
        });
        status.textContent = "";
    } catch (error) {
        status.textContent = error.message;
    } finally {
        button.disabled = false;
        input.focus();
    }
});
