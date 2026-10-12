"use client";

import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Plus, Search, X } from "lucide-react";

export interface ComboboxOption {
  id?: number;
  value: string;
  label: string;
}

interface TaxonomyComboboxProps {
  id?: string;
  label?: string;
  placeholder?: string;
  value: string;
  options: ComboboxOption[];
  onChange: (value: string, option?: ComboboxOption) => void;
  onCreateNew?: (newName: string) => void;
  disabled?: boolean;
  allowCreate?: boolean;
  badgeColorClass?: string;
  className?: string;
}

export function TaxonomyCombobox({
  id,
  label,
  placeholder = "Select option...",
  value,
  options,
  onChange,
  onCreateNew,
  disabled = false,
  allowCreate = true,
  badgeColorClass = "bg-zinc-100 text-zinc-800 border-zinc-200",
  className = "",
}: TaxonomyComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.trim().toLowerCase())
  );

  const exactMatch = options.some(
    (opt) => opt.label.toLowerCase() === search.trim().toLowerCase()
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-[11px] font-medium text-zinc-600 mb-1"
        >
          {label}
        </label>
      )}

      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((prev) => !prev);
            setSearch("");
          }
        }}
        className={`w-full flex items-center justify-between gap-2 rounded-lg bg-white border border-zinc-200/90 px-3 py-2 text-xs text-left transition focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-zinc-50"
            : "hover:border-zinc-300 cursor-pointer"
        }`}
      >
        <span
          className={`truncate ${
            value ? "text-zinc-900 font-medium" : "text-zinc-400"
          }`}
        >
          {value || placeholder}
        </span>
        <ChevronsUpDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
      </button>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full min-w-[210px] rounded-xl bg-white border border-zinc-200/90 shadow-[0_12px_32px_rgba(0,0,0,0.08)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Combobox Search Input */}
          <div className="flex items-center gap-2 px-2.5 py-2 border-b border-zinc-100 bg-zinc-50/50">
            <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter or create..."
              className="w-full bg-transparent text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
            {filtered.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={`${opt.id ?? opt.value}-${opt.label}`}
                  type="button"
                  onClick={() => {
                    onChange(opt.value, opt);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition ${
                    isSelected
                      ? "bg-zinc-100 text-zinc-950 font-semibold"
                      : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-zinc-900 shrink-0" />
                  )}
                </button>
              );
            })}

            {filtered.length === 0 && !allowCreate && (
              <div className="px-3 py-3 text-center text-xs text-zinc-400">
                No matching options
              </div>
            )}

            {allowCreate &&
              onCreateNew &&
              search.trim().length > 0 &&
              !exactMatch && (
                <button
                  type="button"
                  onClick={() => {
                    const clean = search.trim();
                    setOpen(false);
                    setSearch("");
                    onCreateNew(clean);
                  }}
                  className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition mt-1 ${badgeColorClass}`}
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    Create &ldquo;{search.trim()}&rdquo;
                  </span>
                </button>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
