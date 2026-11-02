import { GoogleGenAI, mcpToTool } from '@google/genai';

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import dotenv from "dotenv";
import { Tool } from "@google/genai/web";
import { Readline } from "readline/promises";

dotenv.config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is not set");
}


class MCPClient {
    private mcp: Client;
    private genAI: GoogleGenAI;
    private transport: StdioClientTransport | StreamableHTTPClientTransport | null = null;
    private tools: Tool[] = [];

    constructor() {
        this.genAI = new GoogleGenAI({
            apiKey: GOOGLE_API_KEY,
        });

        this.mcp = new Client({
            name: "dev-mcp-client", 
            version: "1.0.0"
        });
    }

    async connectToServer(serverScriptPath: string) {
        try {
            const isJs = serverScriptPath.endsWith(".js");
            const isPy = serverScriptPath.endsWith(".py");
            if (!isJs && !isPy) {
                throw new Error("Server script must be a .js or .py file");
            }
            const command = isPy
                ? process.platform === "win32"
                    ? "python"
                    : "python3"
                : process.execPath;

            // transport - STDIO
            this.transport = new StdioClientTransport({
                command,
                args: [serverScriptPath],
            });
            await this.mcp.connect(this.transport);  // connect to mcp server using the transport

            const toolsResult = await this.mcp.listTools(); 
            // Instantiate the GoogleGenAI SDK
            console.log('toolsResult', toolsResult);

            this.tools = [{
                functionDeclarations: toolsResult.tools.map((tool) => ({
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.inputSchema as Record<string, any> | undefined,
                })),
            }];

            // Close the connection
            await this.mcp.close();
            
            console.error(
                "Connected to server with tools:",
                this.tools.filter((tool) => tool.functionDeclarations && tool.functionDeclarations.length > 0).map((tool) => tool.functionDeclarations?.map((fd) => fd.name)).flat()
            );
        } catch (e) {
            console.log("Failed to connect to MCP server: ", e);
            throw e;
        }
    }
}

async function main() {
    if (process.argv.length < 3) {
        console.log("Usage: node index.ts <path_to_server_script>");
        return;
    }
    const mcpClient = new MCPClient();
    try {
        await mcpClient.connectToServer(process.argv[2]);
        // await mcpClient.chatLoop();
    } catch (e) {
        // console.error("Error:", e);
        // await mcpClient.cleanup();
        process.exit(1);
    } finally {
        // await mcpClient.cleanup();
        // process.exit(0);
    }
}

main();