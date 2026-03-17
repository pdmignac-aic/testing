import { useState } from 'react';

interface Props {
  content: string | null;
  maxLength?: number;
}

export default function ExpandableCell({ content, maxLength = 60 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const text = content || '—';

  if (text.length <= maxLength) {
    return <span className="text-gray-700">{text}</span>;
  }

  return (
    <div>
      <span className="text-gray-700">
        {expanded ? text : text.slice(0, maxLength) + '...'}
      </span>
      <button
        onClick={() => setExpanded(!expanded)}
        className="ml-1 text-blue-500 hover:text-blue-700 text-xs font-medium"
      >
        {expanded ? 'less' : 'more'}
      </button>
    </div>
  );
}
