import React, {
  useCallback,
  useState,
  useRef,
  useEffect,
  useMemo
} from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import styled from "styled-components";
import {
  useTable,
  usePagination,
  useFilters,
  useGlobalFilter,
  useSortBy
} from "react-table";
import { sortTypes } from "./Sorting";
// A great library for fuzzy filtering/sorting items
import matchSorter from "match-sorter";
import makeData from "./makeData";
import { getFilter } from "./Filters";

const Styles = styled.div`
  padding: 1rem;
  .table-wrapper {
    border: 1px solid rgb(233, 233, 233);
  }

  table {
    border-spacing: 0;

    tr {
      :last-child {
        td {
          border-bottom: 0;
        }
      }
      :nth-child(even) {
        td {
          background: #f7f9fa;
        }
      }
    }
    thead th {
      background-color: #f5f8fa;
      color: #838692;
      border-bottom: 1px solid rgb(233, 233, 233);
    }

    th,
    td {
      margin: 0;
      padding: 0.5rem;
      background-color: white;

      :last-child {
        border-right: 0;
      }
    }
  }

  .pagination {
    padding: 0.5rem;
  }
  .table-wrapper {
    overflow-x: auto;
  }
`;

function fuzzyTextFilterFn(rows, id, filterValue) {
  return matchSorter(rows, filterValue, { keys: [(row) => row.values[id]] });
}

fuzzyTextFilterFn.autoRemove = (val) => !val;

const useFilterTypes = (columns) => {
  const filterTypes = React.useMemo(
    () => ({
      // Add a new fuzzyTextFilterFn filter type.
      fuzzyText: fuzzyTextFilterFn,
      // Or, override the default text filter to use
      // "startWith"
      text: (rows, id, filterValue) => {
        return rows.filter((row) => {
          const rowValue = row.values[id];
          return rowValue !== undefined
            ? String(rowValue)
                .toLowerCase()
                .startsWith(String(filterValue).toLowerCase())
            : true;
        });
      }
    }),
    []
  );
  const [filterVisible, setFilterVisible] = useState({});

  const columnsWithFilters = useMemo(
    () =>
      columns.map((columnDef) => ({
        ...columnDef,
        Filter: columnDef.Filter || getFilter(columnDef.filterType),
        Header: (props) => {
          // props.column contains the react-table connected column. Use it if you want to access column state.
          // columnDef contains the unmodified columnDef from state.
          return (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div
                  style={{
                    paddingRight: 12,
                    display: "flex",
                    alignItems: "center",
                    textAlign: "left",
                    userSelect: "none"
                  }}
                >
                  {columnDef.Header}
                  <div style={{ width: 16, paddingLeft: 4 }}>
                    {props.column.isSorted
                      ? props.column.isSortedDesc
                        ? " 🔽"
                        : " 🔼"
                      : ""}
                  </div>
                </div>

                {props.column.canFilter && props.column.Filter && (
                  <>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setFilterVisible({
                          [columnDef.id]: !filterVisible[columnDef.id]
                        });
                      }}
                    >
                      <svg
                        viewBox="0 0 80 90"
                        focusable={false}
                        width="10"
                        height="10"
                      >
                        <path d="m 0,0 30,45 0,30 10,15 0,-45 30,-45 Z"></path>
                      </svg>
                    </div>
                  </>
                )}
              </div>
              {filterVisible[props.column.id] && (
                <div onClick={(e) => e.stopPropagation()}>
                  {props.column.render("Filter")}
                </div>
              )}
            </div>
          );
        }
      })),
    [columns, filterVisible]
  );

  return { filterTypes, columnsWithFilters };
};

const getStickyOffsets = (widths, columns) => {
  return columns.reduce(
    (acc, column) => {
      const columnWidth = widths[column.id];
      return {
        offset: acc.offset + columnWidth,
        offsetByColumn: {
          ...acc.offsetByColumn,
          [column.id]: acc.offset
        }
      };
    },
    { offset: 0, offsetByColumn: {} }
  ).offsetByColumn;
};

const useStickyColumns = (columns, tableRef) => {
  const orderedColumns = useMemo(() => {
    const originalOrders = columns.reduce((acc, column, index) => {
      return {
        ...acc,
        [column.id]: index
      };
    }, {});

    return [...columns].sort((c1, c2) => {
      if (c1.pinned === "left" && c2.pinned !== "left") {
        return -1;
      }
      if (c2.pinned === "left" && c1.pinned !== "left") {
        return 1;
      }
      if (c1.pinned === "right" && c2.pinned !== "right") {
        return 1;
      }
      if (c2.pinned === "right" && c1.pinned !== "right") {
        return -1;
      }
      return originalOrders[c1.id] - originalOrders[c2.id];
    });
  }, [columns]);

  // we keep widths as state so that it triggers the sticky offset useMemo.
  const [widths, setWidths] = useState({});
  const widthsRef = useRef({});

  const getColumnWidths = useCallback(() => {
    if (tableRef.current) {
      [...tableRef.current.rows[0].cells].forEach((cell, index) => {
        widthsRef.current[orderedColumns[index].id] = cell.clientWidth;
      });
      //if (!widthsRead) {
      if (
        JSON.stringify(widthsRef.current || {}) !== JSON.stringify(widths || {})
      ) {
        console.log("set widths");
        setWidths(widthsRef.current);
      }

      //}
    }
  }, [widths, orderedColumns, setWidths, tableRef]);

  useEffect(() => {
    getColumnWidths();
  }, [getColumnWidths]);

  return useMemo(() => {
    const rightPinnedColumns = [...orderedColumns]
      .reverse()
      .filter((column) => column.pinned === "right");
    const leftPinnedColumns = orderedColumns.filter(
      (column) => column.pinned === "left"
    );

    const rightOffsets = getStickyOffsets(widths, rightPinnedColumns);
    console.log({ rightOffsets, widths: widths, rightPinnedColumns });

    const leftOffsets = getStickyOffsets(widths, leftPinnedColumns);
    const columnsWithStyles = orderedColumns.map((column, index) => {
      return {
        ...column,
        measuredWidth: widths[column.id],
        style: {
          left: column.pinned === "left" ? leftOffsets[column.id] : undefined,
          right:
            column.pinned === "right" ? rightOffsets[column.id] : undefined,
          position: column.pinned ? "sticky" : undefined
        }
      };
    });
    return columnsWithStyles;
  }, [orderedColumns, widths]);
};

const useTableSizing = (width, height) => {
  const pageSize = useMemo(() => Math.floor(height / 30), [height]);

  return pageSize;
};

const Pagination = ({
  gotoPage,
  canPreviousPage,
  canNextPage,
  previousPage,
  nextPage,
  pageCount,
  pageIndex,
  pageOptions
}) => {
  return (
    <div className="pagination">
      <button onClick={() => gotoPage(0)} disabled={!canPreviousPage}>
        {"<<"}
      </button>{" "}
      <button onClick={() => previousPage()} disabled={!canPreviousPage}>
        {"<"}
      </button>{" "}
      <button onClick={() => nextPage()} disabled={!canNextPage}>
        {">"}
      </button>{" "}
      <button onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage}>
        {">>"}
      </button>{" "}
      <span>
        Page{" "}
        <strong>
          {pageIndex + 1} of {pageOptions.length}
        </strong>{" "}
      </span>
    </div>
  );
};

const Table = ({ columns, rows, width, height }) => {
  const tableRef = useRef();

  const columnsWithStyles = useStickyColumns(columns, tableRef);
  //console.log(columnsWithStyles);
  const { filterTypes, columnsWithFilters } = useFilterTypes(columnsWithStyles);
  const calculatedPageSize = useTableSizing(width, height);
  // Use the state and functions returned from useTable to build your UI
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    page, // Instead of using 'rows', we'll use page,
    // which has only the rows for the active page

    // The rest of these things are super handy, too ;)
    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    preGlobalFilteredRows,
    setGlobalFilter,
    state: { pageIndex }
  } = useTable(
    {
      columns: columnsWithFilters,
      data: rows,
      initialState: { pageIndex: 0, pageSize: calculatedPageSize },
      filterTypes,
      sortTypes
    },
    useFilters,
    useGlobalFilter,
    useSortBy,
    usePagination
  );

  useEffect(() => {
    setPageSize(Math.floor(height / 30));
  }, [height, setPageSize]);
  // Render the UI for your table
  return (
    <>
      <div className="table-wrapper">
        <table {...getTableProps()} ref={tableRef}>
          <thead>
            {headerGroups.map((headerGroup) => (
              <tr {...headerGroup.getHeaderGroupProps()}>
                {headerGroup.headers.map((column) => {
                  const headerProps = column.getHeaderProps(
                    column.getSortByToggleProps()
                  );
                  return (
                    <th
                      {...headerProps}
                      style={{
                        ...headerProps.style,
                        ...column.style
                      }}
                    >
                      {column.render("Header")}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody {...getTableBodyProps()}>
            {page.map((row, i) => {
              prepareRow(row);
              return (
                <tr {...row.getRowProps()}>
                  {row.cells.map((cell) => {
                    const cellProps = cell.getCellProps();
                    return (
                      <td
                        {...cellProps}
                        style={{
                          ...cellProps.style,
                          ...cell.column.style
                        }}
                      >
                        {cell.render("Cell")}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* 
        Pagination can be built however you'd like. 
        This is just a very basic UI implementation:
      */}
      <Pagination
        gotoPage={gotoPage}
        canPreviousPage={canPreviousPage}
        canNextPage={canNextPage}
        previousPage={previousPage}
        nextPage={nextPage}
        pageCount={pageCount}
        pageIndex={pageIndex}
        pageOptions={pageOptions}
      />
    </>
  );
};

const columns = [
  {
    id: "firstName",
    Header: "First Name",
    accessor: "firstName",
    renderWith: "nameRenderer",
    sortType: "nameRenderer"
  },
  {
    id: "lastName",
    Header: "Last Name",
    accessor: "lastName"
  },

  {
    id: "age",
    Header: "Age",
    accessor: "age",
    pinned: "left"
  },
  {
    id: "visits",
    Header: "Visits",
    accessor: "visits",
    pinned: "right"
  },
  {
    id: "status",
    Header: "Status",
    accessor: "status",
    pinned: "left"
  },
  {
    id: "progress",
    Header: "Profile Progress",
    accessor: "progress"
  }
];
const data = makeData(1000);

function SearchTable({ rows, columns, height, width }) {
  return (
    <Styles>
      <Table columns={columns} rows={rows} height={height} width={width} />
    </Styles>
  );
}

const component = () => (
  <div style={{ height: 400, width: 500 }}>
    <SearchTable columns={columns} rows={data} height={400} width={500} />
  </div>
);

export default component;
