import { useEffect, useState } from 'react';

import {

  formatFechaPy,

  maskFechaDDMMAAAAInput,

  normalizeToIsoDate,

  parseDDMMAAAA,

} from '@/lib/format-fecha';



interface Props {

  value: string;

  onChange: (isoValue: string) => void;

  className?: string;

  placeholder?: string;

  disabled?: boolean;

  title?: string;

}



/** Entrada de fecha: dd/mm/aaaa o DDMMAAAA (8 dígitos); valor interno yyyy-mm-dd. */

export default function FechaInputPy({

  value,

  onChange,

  className = 'w-full h-10 px-3 rounded-lg border bg-background text-sm',

  placeholder = 'dd/mm/aaaa o DDMMAAAA',

  disabled,

  title,

}: Props) {

  const [text, setText] = useState(() => {

    const iso = normalizeToIsoDate(value);

    return iso ? formatFechaPy(iso) : '';

  });



  useEffect(() => {

    const iso = normalizeToIsoDate(value);

    setText(iso ? formatFechaPy(iso) : '');

  }, [value]);



  return (

    <input

      type="text"

      inputMode="numeric"

      value={text}

      disabled={disabled}

      title={title || 'Formato dd/mm/aaaa o DDMMAAAA (ej. 15032015)'}

      placeholder={placeholder}

      className={className}

      onChange={(e) => {

        const raw = e.target.value;

        const digitsOnly = raw.replace(/\D/g, '');

        if (digitsOnly.length === 8 && !raw.includes('/')) {

          setText(digitsOnly);

          return;

        }

        setText(maskFechaDDMMAAAAInput(raw));

      }}

      onBlur={() => {

        if (!text.trim()) {

          onChange('');

          return;

        }

        const iso = parseDDMMAAAA(text);

        if (iso) {

          onChange(iso);

          setText(formatFechaPy(iso));

        } else {

          const isoPrev = normalizeToIsoDate(value);

          setText(isoPrev ? formatFechaPy(isoPrev) : '');

        }

      }}

    />

  );

}


