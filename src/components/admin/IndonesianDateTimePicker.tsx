import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Check, Sparkles } from 'lucide-react';

interface IndonesianDateTimePickerProps {
  id: string;
  label: string;
  value: string; // ISO string or datetime string
  onChange: (isoString: string) => void;
  helperText?: string;
  required?: boolean;
}

// Format Date object to DD/MM/YYYY HH:mm
export function toIndonesianFormat(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// Convert ISO string to DD/MM/YYYY HH:mm
export function isoToIndonesianString(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return toIndonesianFormat(d);
}

// Parse DD/MM/YYYY HH:mm into a Date object
export function parseIndonesianDateString(str: string): Date | null {
  const clean = str.replace(/\s*WIB/i, '').trim();
  const match = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const year = parseInt(match[3], 10);
  const hours = parseInt(match[4], 10);
  const minutes = parseInt(match[5], 10);

  if (month < 0 || month > 11 || day < 1 || day > 31 || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  const date = new Date(year, month, day, hours, minutes, 0, 0);
  return isNaN(date.getTime()) ? null : date;
}

export const IndonesianDateTimePicker: React.FC<IndonesianDateTimePickerProps> = ({
  id,
  label,
  value,
  onChange,
  helperText,
  required
}) => {
  // Extract initial date components
  const parseInitial = () => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  };

  const initialDate = parseInitial();

  const pad = (n: number) => String(n).padStart(2, '0');

  // Input states
  const [datePart, setDatePart] = useState<string>(
    initialDate ? `${initialDate.getFullYear()}-${pad(initialDate.getMonth() + 1)}-${pad(initialDate.getDate())}` : ''
  );
  const [hourPart, setHourPart] = useState<string>(
    initialDate ? pad(initialDate.getHours()) : '08'
  );
  const [minutePart, setMinutePart] = useState<string>(
    initialDate ? pad(initialDate.getMinutes()) : '00'
  );
  const [textInput, setTextInput] = useState<string>(
    initialDate ? toIndonesianFormat(initialDate) : ''
  );
  const [inputError, setInputError] = useState<string | null>(null);

  // Sync with prop change if value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        const formatted = toIndonesianFormat(d);
        setTextInput(formatted);
        setDatePart(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
        setHourPart(pad(d.getHours()));
        setMinutePart(pad(d.getMinutes()));
        setInputError(null);
      }
    }
  }, [value]);

  // Combine and emit change
  const emitChange = (y: number, m: number, d: number, h: number, min: number) => {
    const newDate = new Date(y, m, d, h, min, 0, 0);
    if (!isNaN(newDate.getTime())) {
      setInputError(null);
      setTextInput(toIndonesianFormat(newDate));
      onChange(newDate.toISOString());
    }
  };

  // Handler when date picker changes
  const handleDateChange = (newDateStr: string) => {
    setDatePart(newDateStr);
    if (!newDateStr) return;
    const parts = newDateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const h = parseInt(hourPart, 10) || 0;
      const min = parseInt(minutePart, 10) || 0;
      emitChange(y, m, d, h, min);
    }
  };

  // Handler when hour changes (24-hour format: 00..23)
  const handleHourChange = (newHour: string) => {
    setHourPart(newHour);
    if (datePart) {
      const parts = datePart.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const h = parseInt(newHour, 10) || 0;
        const min = parseInt(minutePart, 10) || 0;
        emitChange(y, m, d, h, min);
      }
    }
  };

  // Handler when minute changes (00..59)
  const handleMinuteChange = (newMinute: string) => {
    setMinutePart(newMinute);
    if (datePart) {
      const parts = datePart.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const h = parseInt(hourPart, 10) || 0;
        const min = parseInt(newMinute, 10) || 0;
        emitChange(y, m, d, h, min);
      }
    }
  };

  // Handler for direct text typing in format DD/MM/YYYY HH:mm
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTextInput(raw);
    if (!raw.trim()) {
      setInputError(null);
      return;
    }
    const parsed = parseIndonesianDateString(raw);
    if (parsed) {
      setInputError(null);
      setDatePart(`${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`);
      setHourPart(pad(parsed.getHours()));
      setMinutePart(pad(parsed.getMinutes()));
      onChange(parsed.toISOString());
    } else {
      if (raw.length >= 16) {
        setInputError('Gunakan format DD/MM/YYYY HH:mm (contoh: 27/08/2026 08:00)');
      }
    }
  };

  // Preset shortcut applicator
  const applyPreset = (daysFromNow: number, targetHour: number, targetMinute: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysFromNow);
    target.setHours(targetHour, targetMinute, 0, 0);

    const formatted = toIndonesianFormat(target);
    setTextInput(formatted);
    setDatePart(`${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`);
    setHourPart(pad(targetHour));
    setMinutePart(pad(targetMinute));
    setInputError(null);
    onChange(target.toISOString());
  };

  // Generate 24-hour hours list
  const hoursList = Array.from({ length: 24 }, (_, i) => pad(i));
  // Common minutes list
  const minutesList = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55', '59'];

  const currentDisplay = textInput ? `${textInput} WIB` : 'Belum diatur';

  return (
    <div className="space-y-2 p-3.5 rounded-xl bg-gray-50/70 border border-gray-200">
      {/* Label and Formatted Badge */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <label htmlFor={id} className="font-bold text-gray-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[#1E3A8A]" />
          <span>{label}</span>
          {required && <span className="text-rose-500">*</span>}
        </label>
        
        {textInput && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-50 text-[#1E3A8A] border border-blue-200 font-mono font-bold text-[11px]">
            <Check className="w-3 h-3 text-[#1E3A8A]" />
            <span>{currentDisplay}</span>
          </span>
        )}
      </div>

      {/* Main Indonesian 24-Hour Input Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        {/* Direct Text Input (DD/MM/YYYY HH:mm) */}
        <div className="sm:col-span-6">
          <div className="relative">
            <input
              id={id}
              type="text"
              value={textInput}
              onChange={handleTextChange}
              placeholder="DD/MM/YYYY HH:mm (Misal: 27/08/2026 08:00)"
              className={`w-full h-10 pl-3 pr-8 rounded-lg border text-xs font-mono font-bold text-gray-900 bg-white focus:ring-2 focus:ring-blue-700/20 outline-hidden transition-all ${
                inputError ? 'border-rose-400 focus:border-rose-500' : 'border-gray-300 focus:border-blue-700'
              }`}
            />
            <span className="absolute right-2.5 top-2.5 text-[10px] font-bold text-gray-400 font-mono pointer-events-none">
              WIB
            </span>
          </div>
          {inputError && (
            <p className="text-[10px] text-rose-600 font-medium mt-1">{inputError}</p>
          )}
        </div>

        {/* Date Picker Selector */}
        <div className="sm:col-span-3">
          <div className="relative">
            <input
              type="date"
              title="Pilih Tanggal Kalender"
              value={datePart}
              onChange={e => handleDateChange(e.target.value)}
              className="w-full h-10 px-2 rounded-lg border border-gray-300 bg-white text-xs font-medium text-gray-700 focus:border-blue-700 outline-hidden"
            />
          </div>
        </div>

        {/* 24-Hour Time Selectors (Hours & Minutes) - NO AM/PM */}
        <div className="sm:col-span-3 flex items-center gap-1">
          {/* Jam (00 s/d 23) */}
          <div className="flex-1">
            <select
              aria-label="Pilih Jam (Format 24 Jam)"
              value={hourPart}
              onChange={e => handleHourChange(e.target.value)}
              className="w-full h-10 px-1.5 rounded-lg border border-gray-300 bg-white text-xs font-mono font-bold text-gray-900 focus:border-blue-700 outline-hidden"
            >
              {hoursList.map(h => (
                <option key={h} value={h}>
                  {h}:00
                </option>
              ))}
            </select>
          </div>

          <span className="font-bold text-gray-400 font-mono">:</span>

          {/* Menit (00 s/d 59) */}
          <div className="flex-1">
            <select
              aria-label="Pilih Menit"
              value={minutePart}
              onChange={e => handleMinuteChange(e.target.value)}
              className="w-full h-10 px-1.5 rounded-lg border border-gray-300 bg-white text-xs font-mono font-bold text-gray-900 focus:border-blue-700 outline-hidden"
            >
              {minutesList.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Quick Preset Buttons & Format Information */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[10px] text-gray-500">
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-medium text-gray-400">Pintasan Cepat:</span>
          <button
            type="button"
            onClick={() => applyPreset(0, 8, 0)}
            className="px-2 py-0.5 rounded bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-medium transition-colors"
          >
            Hari Ini 08:00
          </button>
          <button
            type="button"
            onClick={() => applyPreset(0, 17, 0)}
            className="px-2 py-0.5 rounded bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-medium transition-colors"
          >
            Hari Ini 17:00
          </button>
          <button
            type="button"
            onClick={() => applyPreset(7, 17, 0)}
            className="px-2 py-0.5 rounded bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-medium transition-colors"
          >
            +7 Hari (17:00 WIB)
          </button>
          <button
            type="button"
            onClick={() => applyPreset(14, 23, 59)}
            className="px-2 py-0.5 rounded bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-medium transition-colors"
          >
            +14 Hari (23:59 WIB)
          </button>
        </div>

        <span className="text-gray-400 italic">
          Standar Indonesia 24 Jam (00:00 - 23:59 WIB)
        </span>
      </div>

      {helperText && (
        <p className="text-[11px] text-gray-500 mt-1">{helperText}</p>
      )}
    </div>
  );
};
