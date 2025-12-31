import * as vscode from "vscode";

type GeminiResponse = any; // để đơn giản MVP

async function callGemini(prompt: string): Promise<string> {
    const cfg = vscode.workspace.getConfiguration("gemini");
    const apiKey = cfg.get<string>("apiKey");
    const model = cfg.get<string>("model") || "gemini-1.5-flash";

    if (!apiKey) {
        throw new Error(
            "Missing Gemini API key. Set it in Settings: gemini.apiKey"
        );
    }

    // Gemini API endpoint (Generative Language API)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
        contents: [
            {
                parts: [{ text: prompt }],
            },
        ],
    };

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error: ${res.status} ${errText}`);
    }

    const data: GeminiResponse = await res.json();
    const text =
        data?.candidates?.[0]?.content?.parts
            ?.map((p: any) => p.text)
            .join("") || "";

    return text.trim() || "(No content returned)";
}

export function activate(context: vscode.ExtensionContext) {
    const output = vscode.window.createOutputChannel("Gemini Explain");

    const disposable = vscode.commands.registerCommand(
        "geminiExplain.explainSelection",
        async () => {
            try {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showWarningMessage("No active editor found.");
                    return;
                }

                const selection = editor.selection;
                const selectedText = editor.document.getText(selection).trim();

                if (!selectedText) {
                    vscode.window.showWarningMessage(
                        "Please select some code to explain."
                    );
                    return;
                }

                const lang = editor.document.languageId;

                // Prompt MVP (ngắn + dễ hiểu cho team)
                const prompt = `
Bạn là trợ lý giải thích code cho sinh viên.
Giải thích đoạn code sau bằng tiếng Việt, ngắn gọn, dễ hiểu:
- Mô tả mục đích đoạn code
- Giải thích từng bước chính
- Nếu có rủi ro/bug tiềm ẩn thì nêu 1-2 ý
- Nếu có thể, đề xuất 1 cải thiện nhỏ

Ngôn ngữ: ${lang}

CODE:
\`\`\`
${selectedText}
\`\`\`
`.trim();

                output.show(true);
                output.appendLine("=== Explaining selection ===");
                output.appendLine(`Language: ${lang}`);
                output.appendLine("");

                const answer = await callGemini(prompt);

                output.appendLine(answer);
                output.appendLine("\n---\n");

                // Optional: copy to clipboard
                await vscode.env.clipboard.writeText(answer);
                vscode.window.showInformationMessage(
                    "Explained! (Copied to clipboard)"
                );
            } catch (e: any) {
                vscode.window.showErrorMessage(e?.message ?? String(e));
            }
        }
    );

    context.subscriptions.push(disposable, output);
}

export function deactivate() {}
