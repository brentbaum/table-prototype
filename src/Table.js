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
import {matchSorter} from "match-sorter";
import makeData from "./makeData";
import { getFilter } from "./Filters";
import {useColumnRenderers} from "./useColumnRenderers";
import {columnRenderers} from "./testRenderers";

const ROW_HEIGHT = 34;
const HEAD_HEIGHT = ROW_HEIGHT + 4
const FOOTER_HEIGHT = 37;

const Styles = styled.div`
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
      height: ${HEAD_HEIGHT}px;
      padding: 0px .5rem;
      position: relative;
    }

    th,
    td {
      margin: 0;
      padding: 0.5rem;
      background-color: white;
      white-space: nowrap;

      :last-child {
        border-right: 0;
      }
    }
  }
  
  .filter-wrapper {
    padding: .5rem;
    background-color: #f5f8fa;
    border: 1px solid rgb(233, 233, 233);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  
  // the first column will be off-screen if the filter wraps left. Wrap it right.
  th:first-child .filter-wrapper {
    right: auto;
    left: 0;
  }
  
  // small div to give the filter popover a connected feeling.
  .filter-arrow {
    position: absolute;
    right: 0;
    left: 0;
    height: 5px;
    bottom: -1px;
    background-color: #f5f8fa;
  }

  .pagination {
    padding: 0.5rem;
  }
  
  .table-wrapper {
    overflow-x: auto;
  }
`;



const FilterWrapper = styled.div`
  position: absolute; 
  top: ${HEAD_HEIGHT}px;
  right: 0px;
`

const useFilterTypes = (columns) => {
  const filterTypes = React.useMemo(
    () => ({
        number: (rows, id) => {
          return true;
        },
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
                    paddingRight: 4,
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
              {filterVisible[columnDef.id] && (
                <>
                  <FilterWrapper
                      onClick={(e) => e.stopPropagation()}
                      className={"filter-wrapper"}>
                    {props.column.render("Filter")}
                    <button onClick={() => setFilterVisible({})}>Done</button>
                  </FilterWrapper>
                  <div className={"filter-arrow"}/>
                </>
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

const useMeasureColumnWidths = (columns, tableRef) => {

  // we keep widths as state so that it triggers the sticky offset useMemo.
  const [widths, setWidths] = useState({});

  const getColumnWidths = useCallback(() => {
      const allWidths = {}
    if (tableRef.current) {
      [...tableRef.current.rows[0].cells].forEach((cell, index) => {
        allWidths[columns[index].id] = cell.clientWidth;
      });

      if (
          JSON.stringify(allWidths) !== JSON.stringify(widths || {})
      ) {
        setWidths(allWidths);
      }

      //}
    }
  }, [widths, columns, setWidths, tableRef]);

  useEffect(() => {
    getColumnWidths();
  }, [getColumnWidths]);

  return widths
}

const useStickyColumns = (columns, widths) => {
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


  return useMemo(() => {
    const rightPinnedColumns = [...orderedColumns]
      .reverse()
      .filter((column) => column.pinned === "right");
    const leftPinnedColumns = orderedColumns.filter(
      (column) => column.pinned === "left"
    );

    const rightOffsets = getStickyOffsets(widths, rightPinnedColumns);

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
  const pageSize = useMemo(() => Math.floor(height / 34), [height]);

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

const usePageSize = (setPageSize, height, width, columnWidths) => {
  useEffect(() => {
    const scrollbarHeight = Object.values(columnWidths).reduce((sum, w) => sum + w, 0) > width ? 10 : 0;
    const nonRowHeight = (HEAD_HEIGHT + FOOTER_HEIGHT + scrollbarHeight);
    setPageSize(Math.floor((height - nonRowHeight) / ROW_HEIGHT));
  }, [height, setPageSize, columnWidths]);
}

const Table = ({ columns, rows, width, height }) => {
  const tableRef = useRef();

  const columnWidths = useMeasureColumnWidths(columns, tableRef)
  const columnsWithStyles = useStickyColumns(columns, columnWidths);
  const { filterTypes, columnsWithFilters } = useFilterTypes(columnsWithStyles);
  const columnsWithRenderers = useColumnRenderers(columnsWithFilters, columnRenderers);
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
      columns: columnsWithRenderers,
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

  usePageSize(setPageSize, height, width, columnWidths);

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

// Hook
function useWindowSize() {
  // Initialize state with undefined width/height so server and client renders match
  // Learn more here: https://joshwcomeau.com/react/the-perils-of-rehydration/
  const [windowSize, setWindowSize] = useState({
    width: undefined,
    height: undefined,
  });

  useEffect(() => {
    // Handler to call on window resize
    function handleResize() {
      // Set window width/height to state
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Call handler right away so state gets updated with initial window size
    handleResize();

    // Remove event listener on cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, []); // Empty array ensures that effect is only run on mount

  return windowSize;
}

const transformColumnForTable = (column) => {
  return {
    ...column,
    accessor: column.dataIndex,
    id: column.dataIndex,
    Header: column.title
  }
}

const Component = ({columns, rows}) => {
  const windowSize = useWindowSize();

  const transformedColumns = columns.map(transformColumnForTable).sort((c1, c2) => c1.sequence - c2.sequence);
  if(!windowSize.height || !windowSize.width) {
    return <></>
  }

  return (
      <div style={{ height: windowSize.height - 20, width: windowSize.width - 20, margin: 10 }}>
        <SearchTable columns={transformedColumns} rows={rows} height={windowSize.height - 20} width={windowSize.width - 20} />
      </div>
  );
}

export default Component;
