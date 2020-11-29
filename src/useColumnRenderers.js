import React, {useMemo} from "react";

function Cell({ value, column, original: row, index, renderers, ...restProps }) {
    if(column.renderWith || !column.render) {
        const renderer = renderers[column.renderWith];

        if (!renderer) {
            return typeof value === "string" ? (
                value
                // formatValue({value, units: col.units, format: col.format})
            ) : (
                <span />
            );
        }
        return renderer(
            value,
            row,
            column,
            // rowSelectionActions,
            // fetch
        );
    }

        return <span>{value}</span>
}
export const useColumnRenderers = (
    columnList = [],
    columnRenderers
) => {
    return useMemo(() => columnList
        .map(col => {
            return {
                ...col,
                dataIndex: col.dataIndex === "assetId" ? "name" : col.dataIndex,
                key: col.key || col.title,
                pinned: col.fixed || col.pinned,
                Cell: props => <Cell {...props} renderers={columnRenderers} />
            };
        }), [columnList]);
};
