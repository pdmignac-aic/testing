import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { getManufacturers, getExportUrl, enrichSingle } from '../api';
import type { Manufacturer } from '../types';
import ExpandableCell from './ExpandableCell';

interface Props {
  batchId: string;
  refreshTrigger: number;
}

const STATUS_ICONS: Record<string, string> = {
  pending: '\u23F3',
  processing: '\uD83D\uDD04',
  complete: '\u2705',
  partial: '\u26A0\uFE0F',
  failed: '\u274C',
};

const columnHelper = createColumnHelper<Manufacturer>();

export default function ResultsTable({ batchId, refreshTrigger }: Props) {
  const [data, setData] = useState<Manufacturer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const hasFetchedRef = useRef(false);

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const sortCol = sorting[0]?.id;
      const sortDir = sorting[0]?.desc ? 'desc' : 'asc';
      const result = await getManufacturers(batchId, {
        search: search || undefined,
        sort_by: sortCol,
        sort_dir: sortDir,
        page,
        page_size: pageSize,
      });
      setData(result.data);
      setTotal(result.total);
      hasFetchedRef.current = true;
    } catch (err) {
      console.error('Failed to fetch manufacturers:', err);
    } finally {
      setLoading(false);
    }
  }, [batchId, search, sorting, page]);

  // Initial load and when search/sort/page changes — show loading
  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Poll refreshes — update data silently without loading state
  useEffect(() => {
    if (hasFetchedRef.current) {
      fetchData(false);
    }
  }, [refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(
    () => [
      columnHelper.accessor('status', {
        header: '',
        cell: (info) => (
          <span title={info.getValue()}>{STATUS_ICONS[info.getValue()] || ''}</span>
        ),
        size: 40,
      }),
      columnHelper.accessor('company_name', {
        header: 'Company Name',
        cell: (info) => <span className="font-medium text-gray-900">{info.getValue()}</span>,
        size: 200,
      }),
      columnHelper.accessor('address', {
        header: 'Address',
        cell: (info) => <ExpandableCell content={info.getValue()} maxLength={40} />,
        size: 200,
      }),
      columnHelper.accessor('website', {
        header: 'Website',
        cell: (info) => {
          const url = info.getValue();
          if (!url) return '—';
          return (
            <a
              href={url.startsWith('http') ? url : `https://${url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm"
            >
              {url.replace(/^https?:\/\//, '')}
            </a>
          );
        },
        size: 160,
      }),
      columnHelper.display({
        id: 'edc',
        header: 'EDC (Name + Contact)',
        cell: ({ row }) => {
          const m = row.original;
          const parts: string[] = [];
          if (m.edc_name) parts.push(m.edc_name);
          if (m.edc_contact_name) parts.push(m.edc_contact_name);
          if (m.edc_contact_email) parts.push(m.edc_contact_email);
          if (m.edc_contact_phone) parts.push(m.edc_contact_phone);
          const text = parts.join(' — ');
          return <ExpandableCell content={text || null} maxLength={50} />;
        },
        size: 280,
      }),
      columnHelper.accessor('major_customers', {
        header: 'Major Customers',
        cell: (info) => <ExpandableCell content={info.getValue()} maxLength={50} />,
        size: 250,
      }),
      columnHelper.accessor('trade_associations', {
        header: 'Trade Associations',
        cell: (info) => {
          const val = info.getValue();
          if (!val) return '—';
          return (
            <div className="text-sm">
              {val.split(',').map((item, i) => {
                const trimmed = item.trim();
                const isConfirmed = trimmed.startsWith('*');
                return (
                  <span
                    key={i}
                    className={`inline-block mr-1 mb-0.5 px-1.5 py-0.5 rounded text-xs ${
                      isConfirmed
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {trimmed}
                  </span>
                );
              })}
            </div>
          );
        },
        size: 250,
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const m = row.original;
          if (m.status === 'complete') return null;
          return (
            <button
              onClick={() => enrichSingle(m.id)}
              className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
              title="Enrich this row"
            >
              Enrich
            </button>
          );
        },
        size: 60,
      }),
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(total / pageSize),
  });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-3 flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search manufacturers..."
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <span className="text-sm text-gray-500">{total} results</span>
        </div>
        <a
          href={getExportUrl(batchId)}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          Export CSV
        </a>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
                    style={{ width: header.getSize() }}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && ' \u2191'}
                      {header.column.getIsSorted() === 'desc' && ' \u2193'}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                  No data found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
