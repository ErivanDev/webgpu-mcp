import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { openDB, type IDBPDatabase } from "idb";
import {
  Play,
  Plus,
  Zap,
  RotateCcw,
  Settings,
  X,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { useLLM } from "./hooks/useLLM";
import { useMCP } from "./hooks/useMCP";

import type { Tool } from "./components/ToolItem";

import {
  parsePythonicCalls,
  extractPythonicCalls,
  extractFunctionAndRenderer,
  generateSchemaFromCode,
  extractToolCallContent,
  mapArgsToNamedParams,
  getErrorMessage,
  isMobileOrTablet,
} from "./utils";

import { DEFAULT_SYSTEM_PROMPT } from "./constants/systemPrompt";
import { DB_NAME, STORE_NAME, SETTINGS_STORE_NAME } from "./constants/db";

import { TEMPLATE, DEFAULT_TOOLS } from "./tools";
import ToolResultRenderer from "./components/ToolResultRenderer";
import ToolCallIndicator from "./components/ToolCallIndicator";
import ToolItem from "./components/ToolItem";
import ResultBlock from "./components/ResultBlock";
import ExamplePrompts from "./components/ExamplePrompts";
import { MCPServerManager } from "./components/MCPServerManager";

import { LoadingScreen } from "./components/LoadingScreen";

interface RenderInfo {
  call: string;
  result?: unknown;
  renderer?: string;
  input?: Record<string, unknown>;
  error?: string;
}

interface BaseMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
interface ToolMessage {
  role: "tool";
  content: string;
  renderInfo: RenderInfo[]; // Rich data for the UI
}
type Message = BaseMessage | ToolMessage;

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        db.createObjectStore(SETTINGS_STORE_NAME, { keyPath: "key" });
      }
    },
  });
}

const App: React.FC = () => {
  const [systemPrompt, setSystemPrompt] = useState<string>(
    DEFAULT_SYSTEM_PROMPT
  );
  const [isSystemPromptModalOpen, setIsSystemPromptModalOpen] =
    useState<boolean>(false);
  const [tempSystemPrompt, setTempSystemPrompt] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [input, setInput] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const isMobile = useMemo(isMobileOrTablet, []);
  const [selectedModelId, setSelectedModelId] = useState<string>(
    isMobile ? "350M" : "1.2B"
  );
  const [isModelDropdownOpen, setIsModelDropdownOpen] =
    useState<boolean>(false);
  const [isMCPManagerOpen, setIsMCPManagerOpen] = useState<boolean>(false);
  const [isToolsPanelVisible, setIsToolsPanelVisible] = useState<boolean>(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimers = useRef<Record<number, NodeJS.Timeout>>({});
  const toolsContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    isLoading,
    isReady,
    error,
    progress,
    loadModel,
    generateResponse,
    clearPastKeyValues,
  } = useLLM(selectedModelId);

  // MCP integration
  const {
    getMCPToolsAsOriginalTools,
    callMCPTool,
    connectAll: connectAllMCPServers,
  } = useMCP();

  const loadTools = useCallback(async (): Promise<void> => {
    const db = await getDB();

    let allTools: Tool[] = await db.getAll(STORE_NAME);

    // Primeira execução
    if (allTools.length === 0) {
      for (const tool of DEFAULT_TOOLS) {
        await db.add(STORE_NAME, tool);
      }

      allTools = await db.getAll(STORE_NAME);
    }

    setTools(allTools.map((t) => ({ ...t, isCollapsed: false })));

    const mcpTools = getMCPToolsAsOriginalTools();
    setTools((prev) => [...prev, ...mcpTools]);
  }, [getMCPToolsAsOriginalTools]);

  useEffect(() => {
    loadTools();
    // Connect to MCP servers on startup
    connectAllMCPServers().catch((error) => {
      console.error("Failed to connect to MCP servers:", error);
    });
  }, [loadTools, connectAllMCPServers]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const updateToolInDB = async (tool: Tool): Promise<void> => {
    const db = await getDB();
    await db.put(STORE_NAME, tool);
  };

  const saveToolDebounced = (tool: Tool): void => {
    if (tool.id !== undefined && debounceTimers.current[tool.id]) {
      clearTimeout(debounceTimers.current[tool.id]);
    }
    if (tool.id !== undefined) {
      debounceTimers.current[tool.id] = setTimeout(() => {
        updateToolInDB(tool);
      }, 300);
    }
  };

  const clearChat = useCallback(() => {
    setMessages([]);
    clearPastKeyValues();
  }, [clearPastKeyValues]);

  const addTool = async (): Promise<void> => {
    const newTool: Omit<Tool, "id"> = {
      name: "new_tool",
      code: TEMPLATE,
      enabled: true,
      isCollapsed: false,
    };
    const db = await getDB();
    const id = await db.add(STORE_NAME, newTool);
    setTools((prev) => {
      const updated = [...prev, { ...newTool, id: id as number }];
      setTimeout(() => {
        if (toolsContainerRef.current) {
          toolsContainerRef.current.scrollTop =
            toolsContainerRef.current.scrollHeight;
        }
      }, 0);
      return updated;
    });
    clearChat();
  };

  const deleteTool = async (id: number): Promise<void> => {
    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id]);
    }
    const db = await getDB();
    await db.delete(STORE_NAME, id);
    setTools(tools.filter((tool) => tool.id !== id));
    clearChat();
  };

  const toggleToolEnabled = (id: number): void => {
    let changedTool: Tool | undefined;
    const newTools = tools.map((tool) => {
      if (tool.id === id) {
        changedTool = { ...tool, enabled: !tool.enabled };
        return changedTool;
      }
      return tool;
    });
    setTools(newTools);
    if (changedTool) saveToolDebounced(changedTool);
  };

  const toggleToolCollapsed = (id: number): void => {
    setTools(
      tools.map((tool) =>
        tool.id === id ? { ...tool, isCollapsed: !tool.isCollapsed } : tool
      )
    );
  };

  const expandTool = (id: number): void => {
    setTools(
      tools.map((tool) =>
        tool.id === id ? { ...tool, isCollapsed: false } : tool
      )
    );
  };

  const handleToolCodeChange = (id: number, newCode: string): void => {
    let changedTool: Tool | undefined;
    const newTools = tools.map((tool) => {
      if (tool.id === id) {
        const { functionCode } = extractFunctionAndRenderer(newCode);
        const schema = generateSchemaFromCode(functionCode);
        changedTool = { ...tool, code: newCode, name: schema.name };
        return changedTool;
      }
      return tool;
    });
    setTools(newTools);
    if (changedTool) saveToolDebounced(changedTool);
  };

  const executeToolCall = async (callString: string): Promise<string> => {
    const parsedCall = parsePythonicCalls(callString);
    if (!parsedCall) throw new Error(`Invalid tool call format: ${callString}`);

    const { name, positionalArgs, keywordArgs } = parsedCall;
    const toolToUse = tools.find((t) => t.name === name && t.enabled);
    if (!toolToUse) throw new Error(`Tool '${name}' not found or is disabled.`);

    // Check if this is an MCP tool
    const isMCPTool = toolToUse.code?.includes("mcpServerId:");
    if (isMCPTool) {
      // Extract MCP server ID and tool name from the code
      const mcpServerMatch = toolToUse.code?.match(/mcpServerId: "([^"]+)"/);
      const mcpToolMatch = toolToUse.code?.match(/toolName: "([^"]+)"/);

      if (mcpServerMatch && mcpToolMatch) {
        const serverId = mcpServerMatch[1];
        const toolName = mcpToolMatch[1];

        // Convert positional and keyword args to a single args object
        const { functionCode } = extractFunctionAndRenderer(toolToUse.code);
        const schema = generateSchemaFromCode(functionCode);
        const paramNames = Object.keys(schema.parameters.properties);

        const args: Record<string, unknown> = {};

        // Map positional args
        for (
          let i = 0;
          i < Math.min(positionalArgs.length, paramNames.length);
          i++
        ) {
          args[paramNames[i]] = positionalArgs[i];
        }

        // Map keyword args
        Object.entries(keywordArgs).forEach(([key, value]) => {
          args[key] = value;
        });

        // Call MCP tool
        const result = await callMCPTool(serverId, toolName, args);
        return JSON.stringify(result);
      }
    }

    // Handle local tools as before
    const { functionCode } = extractFunctionAndRenderer(toolToUse.code);
    const schema = generateSchemaFromCode(functionCode);
    const paramNames = Object.keys(schema.parameters.properties);

    const finalArgs: unknown[] = [];
    const requiredParams = schema.parameters.required || [];

    for (let i = 0; i < paramNames.length; ++i) {
      const paramName = paramNames[i];
      if (i < positionalArgs.length) {
        finalArgs.push(positionalArgs[i]);
      } else if (Object.prototype.hasOwnProperty.call(keywordArgs, paramName)) {
        finalArgs.push(keywordArgs[paramName]);
      } else if (
        Object.prototype.hasOwnProperty.call(
          schema.parameters.properties[paramName],
          "default"
        )
      ) {
        finalArgs.push(schema.parameters.properties[paramName].default);
      } else if (!requiredParams.includes(paramName)) {
        finalArgs.push(undefined);
      } else {
        throw new Error(`Missing required argument: ${paramName}`);
      }
    }

    const bodyMatch = functionCode.match(/function[^{]+\{([\s\S]*)\}/);
    if (!bodyMatch) {
      throw new Error(
        "Could not parse function body. Ensure it's a standard `function` declaration."
      );
    }
    const body = bodyMatch[1];
    const AsyncFunction = Object.getPrototypeOf(
      async function () { }
    ).constructor;
    const func = new AsyncFunction(...paramNames, body);
    const result = await func(...finalArgs);
    return JSON.stringify(result);
  };

  const executeToolCalls = async (
    toolCallContent: string
  ): Promise<RenderInfo[]> => {
    const toolCalls = extractPythonicCalls(toolCallContent);
    if (toolCalls.length === 0)
      return [{ call: "", error: "No valid tool calls found." }];

    const results: RenderInfo[] = [];
    for (const call of toolCalls) {
      try {
        const result = await executeToolCall(call);
        const parsedCall = parsePythonicCalls(call);
        const toolUsed = parsedCall
          ? tools.find((t) => t.name === parsedCall.name && t.enabled)
          : null;
        const { rendererCode } = toolUsed
          ? extractFunctionAndRenderer(toolUsed.code)
          : { rendererCode: undefined };

        let parsedResult;
        try {
          parsedResult = JSON.parse(result);
        } catch {
          parsedResult = result;
        }

        let namedParams: Record<string, unknown> = Object.create(null);
        if (parsedCall && toolUsed) {
          const schema = generateSchemaFromCode(
            extractFunctionAndRenderer(toolUsed.code).functionCode
          );
          const paramNames = Object.keys(schema.parameters.properties);
          namedParams = mapArgsToNamedParams(
            paramNames,
            parsedCall.positionalArgs,
            parsedCall.keywordArgs
          );
        }

        const renderInfo: RenderInfo = {
          call,
          result: parsedResult,
          renderer: rendererCode,
        };
        if (namedParams && Object.keys(namedParams).length > 0) {
          renderInfo.input = namedParams;
        }
        results.push(renderInfo);
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        results.push({ call, error: errorMessage });
      }
    }
    return results;
  };

  const handleSendMessage = async (): Promise<void> => {
    if (!input.trim() || !isReady) return;

    const userMessage: Message = { role: "user", content: input };
    const currentMessages: Message[] = [...messages, userMessage];
    setMessages(currentMessages);
    setInput("");
    setIsGenerating(true);

    try {
      const toolSchemas = tools
        .filter((tool) => tool.enabled)
        .map((tool) => generateSchemaFromCode(tool.code));

      while (true) {
        const messagesForGeneration = [
          { role: "system" as const, content: systemPrompt },
          ...currentMessages,
        ];

        setMessages([...currentMessages, { role: "assistant", content: "" }]);

        let accumulatedContent = "";
        const response = await generateResponse(
          messagesForGeneration,
          toolSchemas,
          (token: string) => {
            accumulatedContent += token;
            setMessages((current) => {
              const updated = [...current];
              updated[updated.length - 1] = {
                role: "assistant",
                content: accumulatedContent,
              };
              return updated;
            });
          }
        );

        currentMessages.push({ role: "assistant", content: response });
        const toolCallContent = extractToolCallContent(response);

        if (toolCallContent) {
          const toolResults = await executeToolCalls(toolCallContent);

          const toolMessage: ToolMessage = {
            role: "tool",
            content: JSON.stringify(toolResults.map((r) => r.result ?? null)),
            renderInfo: toolResults,
          };
          currentMessages.push(toolMessage);
          setMessages([...currentMessages]);
          continue;
        } else {
          setMessages(currentMessages);
          break;
        }
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setMessages([
        ...currentMessages,
        {
          role: "assistant",
          content: `Error generating response: ${errorMessage}`,
        },
      ]);
    } finally {
      setIsGenerating(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const loadSystemPrompt = useCallback(async (): Promise<void> => {
    try {
      const db = await getDB();
      const stored = await db.get(SETTINGS_STORE_NAME, "systemPrompt");
      if (stored && stored.value) setSystemPrompt(stored.value);
    } catch (error) {
      console.error("Failed to load system prompt:", error);
    }
  }, []);

  const saveSystemPrompt = useCallback(
    async (prompt: string): Promise<void> => {
      try {
        const db = await getDB();
        await db.put(SETTINGS_STORE_NAME, {
          key: "systemPrompt",
          value: prompt,
        });
      } catch (error) {
        console.error("Failed to save system prompt:", error);
      }
    },
    []
  );

  const loadSelectedModel = useCallback(async (): Promise<void> => {
    try {
      await loadModel();
    } catch (error) {
      console.error("Failed to load model:", error);
    }
  }, [loadModel]);

  const loadSelectedModelId = useCallback(async (): Promise<void> => {
    try {
      const db = await getDB();
      const stored = await db.get(SETTINGS_STORE_NAME, "selectedModelId");
      if (stored && stored.value) {
        setSelectedModelId(stored.value);
      }
    } catch (error) {
      console.error("Failed to load selected model ID:", error);
    }
  }, []);

  useEffect(() => {
    loadSystemPrompt();
  }, [loadSystemPrompt]);

  const handleOpenSystemPromptModal = (): void => {
    setTempSystemPrompt(systemPrompt);
    setIsSystemPromptModalOpen(true);
  };

  const handleSaveSystemPrompt = (): void => {
    setSystemPrompt(tempSystemPrompt);
    saveSystemPrompt(tempSystemPrompt);
    setIsSystemPromptModalOpen(false);
  };

  const handleCancelSystemPrompt = (): void => {
    setTempSystemPrompt("");
    setIsSystemPromptModalOpen(false);
  };

  const handleResetSystemPrompt = (): void => {
    setTempSystemPrompt(DEFAULT_SYSTEM_PROMPT);
  };

  const saveSelectedModel = useCallback(
    async (modelId: string): Promise<void> => {
      try {
        const db = await getDB();
        await db.put(SETTINGS_STORE_NAME, {
          key: "selectedModelId",
          value: modelId,
        });
      } catch (error) {
        console.error("Failed to save selected model ID:", error);
      }
    },
    []
  );

  useEffect(() => {
    loadSystemPrompt();
    loadSelectedModelId();
  }, [loadSystemPrompt, loadSelectedModelId]);

  const handleModelSelect = async (modelId: string) => {
    setSelectedModelId(modelId);
    setIsModelDropdownOpen(false);
    await saveSelectedModel(modelId);
  };

  const handleExampleClick = async (messageText: string): Promise<void> => {
    if (!isReady || isGenerating) return;
    setInput(messageText);

    const userMessage: Message = { role: "user", content: messageText };
    const currentMessages: Message[] = [...messages, userMessage];
    setMessages(currentMessages);
    setInput("");
    setIsGenerating(true);

    try {
      const toolSchemas = tools
        .filter((tool) => tool.enabled)
        .map((tool) => generateSchemaFromCode(tool.code));

      while (true) {
        const messagesForGeneration = [
          { role: "system" as const, content: systemPrompt },
          ...currentMessages,
        ];

        setMessages([...currentMessages, { role: "assistant", content: "" }]);

        let accumulatedContent = "";
        const response = await generateResponse(
          messagesForGeneration,
          toolSchemas,
          (token: string) => {
            accumulatedContent += token;
            setMessages((current) => {
              const updated = [...current];
              updated[updated.length - 1] = {
                role: "assistant",
                content: accumulatedContent,
              };
              return updated;
            });
          }
        );

        currentMessages.push({ role: "assistant", content: response });
        const toolCallContent = extractToolCallContent(response);

        if (toolCallContent) {
          const toolResults = await executeToolCalls(toolCallContent);

          const toolMessage: ToolMessage = {
            role: "tool",
            content: JSON.stringify(toolResults.map((r) => r.result ?? null)),
            renderInfo: toolResults,
          };
          currentMessages.push(toolMessage);
          setMessages([...currentMessages]);
          continue;
        } else {
          setMessages(currentMessages);
          break;
        }
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setMessages([
        ...currentMessages,
        {
          role: "assistant",
          content: `Error generating response: ${errorMessage}`,
        },
      ]);
    } finally {
      setIsGenerating(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  return (
    <div className="font-sans bg-gray-900">
      {!isReady ? (
        <LoadingScreen
          isLoading={isLoading}
          progress={progress}
          error={error}
          loadSelectedModel={loadSelectedModel}
          selectedModelId={selectedModelId}
          isModelDropdownOpen={isModelDropdownOpen}
          setIsModelDropdownOpen={setIsModelDropdownOpen}
          handleModelSelect={handleModelSelect}
        />
      ) : (
        <div className="flex h-screen text-white">
          <div
            className={`flex flex-col p-4 transition-all duration-300 ${isToolsPanelVisible ? "w-1/2" : "w-full"
              }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-200">LFM2 MCP</h1>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center text-green-400">
                  <Zap size={16} className="mr-2" />
                  Ready
                </div>
                <button
                  disabled={isGenerating}
                  onClick={clearChat}
                  className={`h-10 flex items-center px-3 py-2 rounded-lg font-bold transition-colors text-sm ${isGenerating
                    ? "bg-gray-600 cursor-not-allowed opacity-50"
                    : "bg-gray-600 hover:bg-gray-700"
                    }`}
                  title="Clear chat"
                >
                  <RotateCcw size={14} className="mr-2" /> Clear
                </button>
                <button
                  onClick={handleOpenSystemPromptModal}
                  className="h-10 flex items-center px-3 py-2 rounded-lg font-bold transition-colors bg-gray-600 hover:bg-gray-700 text-sm"
                  title="Edit system prompt"
                >
                  <Settings size={16} />
                </button>
                <button
                  onClick={() => setIsMCPManagerOpen(true)}
                  className="h-10 flex items-center px-3 py-2 rounded-lg font-bold transition-colors bg-blue-600 hover:bg-blue-700 text-sm"
                  title="Manage MCP Servers"
                >
                  🌐
                </button>
                <button
                  onClick={() => setIsToolsPanelVisible(!isToolsPanelVisible)}
                  className="h-10 flex items-center px-3 py-2 rounded-lg font-bold transition-colors bg-gray-600 hover:bg-gray-700 text-sm"
                  title={
                    isToolsPanelVisible
                      ? "Hide Tools Panel"
                      : "Show Tools Panel"
                  }
                >
                  {isToolsPanelVisible ? (
                    <PanelRightClose size={16} />
                  ) : (
                    <PanelRightOpen size={16} />
                  )}
                </button>
              </div>
            </div>

            <div
              ref={chatContainerRef}
              className="flex-grow bg-gray-800 rounded-lg p-4 overflow-y-auto mb-4 space-y-4"
            >
              {messages.length === 0 && isReady ? (
                <ExamplePrompts
                  examples={tools
                    .filter((tool) => tool.enabled)
                    .map((tool) => ({
                      icon: "🛠️",
                      displayText: tool.name,
                      messageText: `${tool.name}()`,
                    }))
                    .filter((ex) => ex.displayText)}
                  onExampleClick={handleExampleClick}
                />
              ) : (
                messages.map((msg, index) => {
                  const key = `${msg.role}-${index}`;

                  if (msg.role === "user") {
                    return (
                      <div key={key} className="flex justify-end">
                        <div className="p-3 rounded-lg max-w-md bg-indigo-600">
                          <p className="text-sm whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    );
                  } else if (msg.role === "assistant") {
                    const isToolCall = msg.content.includes(
                      "<|tool_call_start|>"
                    );

                    if (isToolCall) {
                      const nextMessage = messages[index + 1];
                      const isCompleted = nextMessage?.role === "tool";
                      const hasError =
                        isCompleted &&
                        (nextMessage as ToolMessage).renderInfo.some(
                          (info) => !!info.error
                        );

                      return (
                        <div key={key} className="flex justify-start">
                          <div className="p-3 rounded-lg bg-gray-700">
                            <ToolCallIndicator
                              content={msg.content}
                              isRunning={!isCompleted}
                              hasError={hasError}
                            />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={key} className="flex justify-start">
                        <div className="p-3 rounded-lg max-w-md bg-gray-700">
                          <p className="text-sm whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    );
                  } else if (msg.role === "tool") {
                    const visibleToolResults = msg.renderInfo.filter(
                      (info) =>
                        info.error || (info.result != null && info.renderer)
                    );

                    if (visibleToolResults.length === 0) return null;

                    return (
                      <div key={key} className="flex justify-start">
                        <div className="p-3 rounded-lg bg-gray-700 max-w-lg">
                          <div className="space-y-3">
                            {visibleToolResults.map((info, idx) => (
                              <div className="flex flex-col gap-2" key={idx}>
                                <div className="text-xs text-gray-400 font-mono">
                                  {info.call}
                                </div>
                                {info.error ? (
                                  <ResultBlock error={info.error} />
                                ) : (
                                  <ToolResultRenderer
                                    result={info.result}
                                    rendererCode={info.renderer}
                                    input={info.input}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })
              )}
            </div>

            <div className="flex">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  !isGenerating &&
                  isReady &&
                  handleSendMessage()
                }
                disabled={isGenerating || !isReady}
                className="flex-grow bg-gray-700 rounded-l-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                placeholder={
                  isReady
                    ? "Type your message here..."
                    : "Load model first to enable chat"
                }
              />
              <button
                onClick={handleSendMessage}
                disabled={isGenerating || !isReady}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold p-3 rounded-r-lg transition-colors"
              >
                <Play size={20} />
              </button>
            </div>
          </div>

          {isToolsPanelVisible && (
            <div className="w-1/2 flex flex-col p-4 border-l border-gray-700 transition-all duration-300">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-teal-400">Tools</h2>
                <button
                  onClick={addTool}
                  className="flex items-center bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  <Plus size={16} className="mr-2" /> Add Tool
                </button>
              </div>
              <div
                ref={toolsContainerRef}
                className="flex-grow bg-gray-800 rounded-lg p-4 overflow-y-auto space-y-3"
              >
                {tools.map((tool) => (
                  <ToolItem
                    key={tool.id}
                    tool={tool}
                    onToggleEnabled={() => toggleToolEnabled(tool.id)}
                    onToggleCollapsed={() => toggleToolCollapsed(tool.id)}
                    onExpand={() => expandTool(tool.id)}
                    onDelete={() => deleteTool(tool.id)}
                    onCodeChange={(newCode) =>
                      handleToolCodeChange(tool.id, newCode)
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isSystemPromptModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-3/4 max-w-4xl max-h-3/4 flex flex-col text-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-indigo-400">
                Edit System Prompt
              </h2>
              <button
                onClick={handleCancelSystemPrompt}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-grow mb-4">
              <textarea
                value={tempSystemPrompt}
                onChange={(e) => setTempSystemPrompt(e.target.value)}
                className="w-full h-full bg-gray-700 text-white p-4 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter your system prompt here..."
                style={{ minHeight: "300px" }}
              />
            </div>
            <div className="flex justify-between">
              <button
                onClick={handleResetSystemPrompt}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
              >
                Reset
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveSystemPrompt}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MCP Server Manager Modal */}
      <MCPServerManager
        isOpen={isMCPManagerOpen}
        onClose={() => setIsMCPManagerOpen(false)}
      />
    </div>
  );
};

export default App;
