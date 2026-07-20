import { ChevronDown } from "lucide-react";
import { MODEL_OPTIONS } from "../constants/models";
import LiquidAILogo from "./icons/LiquidAILogo";
import HfLogo from "./icons/HfLogo";
import MCPLogo from "./icons/MCPLogo";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";

type Dot = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  opacity: number;
  blur: number;
  pulse: number;
  pulseSpeed: number;
};
export const LoadingScreen = ({
  isLoading,
  progress,
  error,
  loadSelectedModel,
  selectedModelId,
  isModelDropdownOpen,
  setIsModelDropdownOpen,
  handleModelSelect,
}: {
  isLoading: boolean;
  progress: number;
  error: string | null;
  loadSelectedModel: () => void;
  selectedModelId: string;
  isModelDropdownOpen: boolean;
  setIsModelDropdownOpen: (isOpen: boolean) => void;
  handleModelSelect: (modelId: string) => void;
}) => {
  const model = useMemo(
    () => MODEL_OPTIONS.find((opt) => opt.id === selectedModelId),
    [selectedModelId]
  );

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropdownBtnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null); // NEW: anchor for centering

  // For keyboard navigation
  const [activeIndex, setActiveIndex] = useState(
    Math.max(
      0,
      MODEL_OPTIONS.findIndex((m) => m.id === selectedModelId)
    )
  );

  // Background Animation Effect (crisper dots + reduced motion)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let animationFrameId: number;
    let dots: Dot[] = [];

    const setup = () => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const { innerWidth, innerHeight } = window;
      canvas.width = Math.floor(innerWidth * dpr);
      canvas.height = Math.floor(innerHeight * dpr);
      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      dots = [];
      const numDots = Math.floor((innerWidth * innerHeight) / 12000);
      for (let i = 0; i < numDots; ++i) {
        dots.push({
          x: Math.random() * innerWidth,
          y: Math.random() * innerHeight,
          radius: Math.random() * 2 + 0.3,
          speed: prefersReduced ? 0 : Math.random() * 0.3 + 0.05,
          opacity: Math.random() * 0.4 + 0.1,
          blur: Math.random() > 0.8 ? Math.random() * 1.5 + 0.5 : 0,
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: prefersReduced ? 0 : Math.random() * 0.02 + 0.01,
        });
      }
    };

    const draw = () => {
      if (!ctx) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx.clearRect(0, 0, width, height);

      dots.forEach((dot) => {
        dot.y += dot.speed;
        dot.pulse += dot.pulseSpeed;

        if (dot.y > height + dot.radius) {
          dot.y = -dot.radius;
          dot.x = Math.random() * width;
        }

        const pulseFactor = 1 + Math.sin(dot.pulse) * 0.2;
        const currentRadius = dot.radius * pulseFactor;
        const currentOpacity = dot.opacity * (0.8 + Math.sin(dot.pulse) * 0.2);

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity})`;
        if (dot.blur > 0) ctx.filter = `blur(${dot.blur}px)`;
        ctx.fill();
        ctx.filter = "none";
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    const handleResize = () => {
      cancelAnimationFrame(animationFrameId);
      setup();
      draw();
    };

    setup();
    draw();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Close dropdown on Escape / click outside
  useEffect(() => {
    if (!isModelDropdownOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsModelDropdownOpen(false);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(MODEL_OPTIONS.length - 1, i + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const opt = MODEL_OPTIONS[activeIndex];
        if (opt) {
          handleModelSelect(opt.id);
          setIsModelDropdownOpen(false);
          dropdownBtnRef.current?.focus();
        }
      }
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        !dropdownBtnRef.current?.contains(target)
      ) {
        setIsModelDropdownOpen(false);
      }
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [
    isModelDropdownOpen,
    activeIndex,
    setIsModelDropdownOpen,
    handleModelSelect,
  ]);

  // Recompute portal position on open + resize
  const [, forceRerender] = useState(0);
  useEffect(() => {
    const onResize = () => forceRerender((x) => x + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Compute portal style based on the whole button group (center + clamp + optional drop-up)
  const portalStyle = useMemo(() => {
    if (typeof window === "undefined") return {};
    const anchor = wrapperRef.current || dropdownBtnRef.current;
    if (!anchor) return {};

    const rect = anchor.getBoundingClientRect();

    const margin = 8;
    const minWidth = 320;
    const dropdownWidth = Math.max(rect.width, minWidth);

    // Center
    let left = Math.round(rect.left + rect.width / 2 - dropdownWidth / 2);
    // Clamp to viewport
    left = Math.min(
      Math.max(margin, left),
      window.innerWidth - dropdownWidth - margin
    );

    // Flip up if not enough space below
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedItemH = 56; // rough item height
    const estimatedPad = 16;
    const estimatedHeight =
      estimatedItemH * Math.min(MODEL_OPTIONS.length, 6) + estimatedPad;
    const dropUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    const top = dropUp ? rect.top - estimatedHeight - 8 : rect.bottom + 8;

    return {
      position: "fixed" as const,
      left: `${left}px`,
      top: `${top}px`,
      width: `${dropdownWidth}px`,
      zIndex: 100,
    };
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white p-6 overflow-hidden">
      {/* Background Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full z-0"
      />

      {/* Vignette Overlay */}
      <div className="absolute top-0 left-0 w-full h-full z-10 bg-[radial-gradient(ellipse_at_center,_rgba(15,23,42,0.1)_0%,_rgba(15,23,42,0.4)_40%,_rgba(15,23,42,0.9)_100%)]" />

      {/* Grid Overlay */}
      <div className="absolute inset-0 z-5 opacity-[0.02] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:50px_50px]" />

      {/* Main Content */}
      <div className="relative z-20 max-w-4xl w-full flex flex-col items-center">
        {/* Logos */}
        <div className="flex items-center justify-center mb-8 gap-5">
          <a
            href="https://www.liquid.ai/"
            target="_blank"
            rel="noopener noreferrer"
            title="Liquid AI"
            className="transform transition-all duration-300 hover:scale-105 hover:-translate-y-1"
          >
            <LiquidAILogo className="h-16 md:h-20 text-gray-300 hover:text-white drop-shadow-lg" />
          </a>
          <span className="text-gray-500 text-3xl font-extralight">×</span>
          <a
            href="https://huggingface.co/docs/transformers.js"
            target="_blank"
            rel="noopener noreferrer"
            title="Transformers.js"
            className="transform transition-all duration-300 hover:scale-105 hover:-translate-y-1"
          >
            <HfLogo className="h-16 md:h-20 text-gray-300 hover:text-white drop-shadow-lg" />
          </a>
          <span className="text-gray-500 text-3xl font-extralight">×</span>
          <a
            href="https://modelcontextprotocol.io/"
            target="_blank"
            rel="noopener noreferrer"
            title="Model Context Protocol"
            className="transform transition-all duration-300 hover:scale-105 hover:-translate-y-1"
          >
            <MCPLogo className="h-16 md:h-20 text-gray-300 hover:text-white drop-shadow-lg" />
          </a>
        </div>

        {/* Hero */}
        <div className="text-center mb-8 space-y-4">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent tracking-tight leading-none">
            LFM2 MCP
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-gray-300 font-light leading-relaxed">
            Run next-gen hybrid models in your browser with tools powered by the{" "}
            <a
              href="https://modelcontextprotocol.io/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="text-indigo-400 font-medium">
                Model Context Protocol (MCP)
              </span>{" "}
              enabling secure, real-time connections to remote servers.
            </a>
          </p>
          <div className="w-24 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full mx-auto" />
        </div>

        {/* Description Cards */}
        <div className="grid md:grid-cols-2 gap-6 text-gray-400 mb-10">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <h3 className="text-white font-semibold mb-3 flex items-center">
              <div className="w-2 h-2 bg-indigo-500 rounded-full mr-3" />
              Model Context Protocol
            </h3>
            <p className="text-sm leading-relaxed">
              Connect seamlessly to remote{" "}
              <a
                href="https://modelcontextprotocol.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:underline"
              >
                MCP servers
              </a>{" "}
              using streaming or SSE protocols with support for no-auth, basic
              auth, and OAuth.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <h3 className="text-white font-semibold mb-3 flex items-center">
              <div className="w-2 h-2 bg-purple-500 rounded-full mr-3" />
              Edge AI Technology
            </h3>
            <p className="text-sm leading-relaxed">
              Powered by{" "}
              <a
                href="https://www.liquid.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:underline"
              >
                Liquid AI’s
              </a>{" "}
              LFM2 hybrid models, optimized for on-device deployment and edge AI
              scenarios.
            </p>
          </div>
        </div>

        <p className="text-gray-400 text-base sm:text-lg mb-10">
          Everything runs entirely in your browser with{" "}
          <a
            href="https://huggingface.co/docs/transformers.js"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:underline font-medium"
          >
            Transformers.js
          </a>{" "}
          and ONNX Runtime Web.
        </p>

        {/* Action */}
        <div className="text-center space-y-6">
          <p className="text-gray-400 text-base sm:text-lg font-medium">
            Select a model to load locally, and connect to a remote MCP server
            to get started.
          </p>

          <div className="relative">
            <div
              ref={wrapperRef} // anchor for dropdown centering
              className="flex rounded-2xl shadow-2xl overflow-hidden"
            >
              <button
                onClick={isLoading ? undefined : loadSelectedModel}
                disabled={isLoading}
                className={`flex items-center justify-center font-bold transition-all text-lg flex-1 ${
                  isLoading
                    ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg hover:shadow-xl transform hover:scale-[1.01] active:scale-[0.99]"
                }`}
                aria-live="polite"
                aria-busy={isLoading}
                aria-label={
                  isLoading
                    ? `Loading ${model?.label ?? "model"} ${progress}%`
                    : `Load ${model?.label ?? "model"}`
                }
              >
                <div className="px-8 py-4">
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span className="ml-3 font-semibold">
                        Loading... {progress}%
                      </span>
                    </div>
                  ) : (
                    <span className="font-semibold">Load {model?.label}</span>
                  )}
                </div>
              </button>

              <button
                ref={dropdownBtnRef}
                onClick={(e) => {
                  if (!isLoading) {
                    e.stopPropagation();
                    setIsModelDropdownOpen(!isModelDropdownOpen);
                    setActiveIndex(
                      Math.max(
                        0,
                        MODEL_OPTIONS.findIndex((m) => m.id === selectedModelId)
                      )
                    );
                  }
                }}
                onKeyDown={(e) => {
                  if (isLoading) return;
                  if (
                    e.key === " " ||
                    e.key === "Enter" ||
                    e.key === "ArrowDown"
                  ) {
                    e.preventDefault();
                    if (!isModelDropdownOpen) setIsModelDropdownOpen(true);
                  }
                }}
                aria-haspopup="menu"
                aria-expanded={isModelDropdownOpen}
                aria-controls="model-dropdown"
                aria-label="Select model"
                className={`px-4 py-4 border-l border-white/20 transition-all ${
                  isLoading
                    ? "bg-gray-700 cursor-not-allowed"
                    : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 hover:shadow-lg transform hover:scale-[1.01] active:scale-[0.99]"
                }`}
                disabled={isLoading}
              >
                <ChevronDown
                  size={20}
                  className={`transition-transform duration-200 ${
                    isModelDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>

            {/* Dropdown (Portal) */}
            {isModelDropdownOpen &&
              typeof document !== "undefined" &&
              ReactDOM.createPortal(
                <div
                  id="model-dropdown"
                  ref={dropdownRef}
                  style={portalStyle}
                  role="menu"
                  aria-label="Model options"
                  className="bg-gray-800/95 border border-gray-600/50 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200 dropdown-z30"
                >
                  {MODEL_OPTIONS.map((option, index) => {
                    const selected = selectedModelId === option.id;
                    const isActive = activeIndex === index;
                    return (
                      <button
                        key={option.id}
                        role="menuitem"
                        aria-checked={selected}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => {
                          handleModelSelect(option.id);
                          setIsModelDropdownOpen(false);
                          dropdownBtnRef.current?.focus();
                        }}
                        className={`w-full px-6 py-4 text-left transition-all duration-200 relative group outline-none ${
                          selected
                            ? "bg-gradient-to-r from-indigo-600/50 to-purple-600/50 text-white border-l-4 border-indigo-400"
                            : "text-gray-200 hover:bg-white/10 hover:text-white"
                        } ${index === 0 ? "rounded-t-2xl" : ""} ${
                          index === MODEL_OPTIONS.length - 1
                            ? "rounded-b-2xl"
                            : ""
                        } ${isActive && !selected ? "bg-white/5" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-lg">
                              {option.label}
                            </div>
                            <div className="text-sm text-gray-400 mt-1">
                              {option.size}
                            </div>
                          </div>
                          {selected && (
                            <div className="w-2 h-2 bg-indigo-400 rounded-full" />
                          )}
                        </div>
                        {!selected && (
                          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                        )}
                      </button>
                    );
                  })}
                </div>,
                document.body
              )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="bg-red-900/30 backdrop-blur-sm border border-red-500/50 rounded-2xl p-6 mt-8 max-w-md text-center"
          >
            <p className="text-red-200 mb-4 font-medium">Error: {error}</p>
            <button
              onClick={loadSelectedModel}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 px-6 py-3 rounded-xl font-semibold transition-all transform hover:scale-105 active:scale-95 shadow-lg"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Click-away fallback for touch devices */}
      {isModelDropdownOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={(e) => {
            const target = e.target as Node;
            if (
              dropdownRef.current &&
              !dropdownRef.current.contains(target) &&
              !dropdownBtnRef.current?.contains(target)
            ) {
              setIsModelDropdownOpen(false);
            }
          }}
        />
      )}
    </div>
  );
};
