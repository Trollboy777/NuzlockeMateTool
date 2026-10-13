const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const messages = document.getElementById("messages");
const status = document.getElementById("status");

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

    try {
        const response = await fetch("/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ message })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Something went wrong.");
        }

        addMessage(data.reply, "assistant");
        status.textContent = "";
    } catch (error) {
        status.textContent = error.message;
    } finally {
        button.disabled = false;
        input.focus();
    }
});
