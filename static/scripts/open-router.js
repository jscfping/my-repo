const vm = new Vue({
    el: "#app",
    data: {
        apiKey: "",
        models: `deepseek/deepseek-v4-flash-0731
deepseek/deepseek-chat-v3.1
deepseek/deepseek-v4-pro`,
        chatGPTData1: {
            headData: [
                {
                    role: "system",
                    content: [
                        {
                            type: "text",
                            text: ""
                        }
                    ]
                }
            ],
            model: "",
            temperature: 0.8,
            max_tokens: 8192,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
            inputMessage: "",
            messages: [],
            loading: false
        },
        chatGPTData2: {
            headData: [
                {
                    role: "system",
                    content: [
                        {
                            type: "text",
                            text: ""
                        }
                    ]
                }
            ],
            model: "",
            temperature: 0.8,
            max_tokens: 8192,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
            inputMessage: "",
            messages: [],
            loading: false
        }
    },
    mounted() {
        const urlParams = new URLSearchParams(window.location.search);
        const defaultModel = this.models.split("\n")[0].trim();
        this.apiKey = urlParams.get("apiKey");
        this.chatGPTData1.model = defaultModel;
        this.chatGPTData2.model = defaultModel;
        const system1 = urlParams.get("system1");
        const system2 = urlParams.get("system2");
        if (system1) {
            this.chatGPTData1.headData[0].content[0].text = system1;
        }
        if (system2) {
            this.chatGPTData2.headData[0].content[0].text = system2;
        }
    },
    methods: {
        getAuthorization() {
            return `Bearer ${this.apiKey}`;
        },
        scrollResponseToBottom(id) {
            this.$nextTick(() => {
                const refName = `respTextarea${id}`;
                const textareaArray = this.$refs[refName];
                if (textareaArray && textareaArray.length > 0) {
                    const textarea = textareaArray[0];
                    textarea.scrollTop = textarea.scrollHeight;
                }
            });
        },
        async sendAsync(id) {
            const chatGPTData = id === 1 ? this.chatGPTData1 : this.chatGPTData2;
            const req = chatGPTData.inputMessage;
            chatGPTData.inputMessage = "";
            chatGPTData.loading = true;

            const reqData = {
                model: chatGPTData.model,
                provider: {
                    order: ["NovitaAI"],
                    allow_fallbacks: true
                },
                messages: chatGPTData.headData.concat({
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: req
                        }
                    ]
                }),
                temperature: Number(chatGPTData.temperature),
                max_tokens: Number(chatGPTData.max_tokens),
                top_p: Number(chatGPTData.top_p),
                frequency_penalty: Number(chatGPTData.frequency_penalty),
                presence_penalty: Number(chatGPTData.presence_penalty),
                stream: true
            };

            let fullResponse = "";

            try {
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": this.getAuthorization()
                    },
                    body: JSON.stringify(reqData)
                });

                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                const newMsg = {
                    req: req,
                    res: ""
                };

                chatGPTData.messages.unshift(newMsg);

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const text = decoder.decode(value);
                    const lines = text.split("\n");

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const data = line.slice(6);
                            if (data === "[DONE]") {
                                break;
                            }
                            try {
                                const json = JSON.parse(data);
                                const content = json.choices[0]?.delta?.content || "";
                                fullResponse += content;
                                newMsg.res = fullResponse;
                                if (json.choices[0]?.finish_reason) {
                                    newMsg.res += `\n=====finish_reason=====\n${json.choices[0]?.finish_reason}`;
                                }
                                this.scrollResponseToBottom(id);
                            } catch (e) {
                                // ignore parse errors
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("Error:", error);
                chatGPTData.messages.unshift({
                    req: req,
                    res: `Error: ${error.message}`
                });
            } finally {
                chatGPTData.loading = false;
            }
        }
    }
});
