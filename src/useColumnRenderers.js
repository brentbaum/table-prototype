import React, {useState, useMemo} from "react";
import styled from "styled-components";
import {getFormattedLocalDatetime} from "./time";

const booleanRenderer = (value, row) => {
    if (row && row.filler) {
        return <></>;
    }
    return (
        value ? "√" : "-"
    );
};

const dateRenderer = (value) => {
    if(!value) {
        return <span></span>
    }
    try {
        const date = new Date(value);
        return <span>{getFormattedLocalDatetime(date)}</span>
    } catch(e) {
        return <span>-</span>
    }
};


const columnRenderers = {
    booleanRenderer,
    dateRenderer
};

function MyCell({ value, column, row, index, ...restProps }) {
    console.log(row, restProps)
    if(column.renderWith || !column.render) {
        const renderer = columnRenderers[column.renderWith];

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
            row.values,
            column,
            // rowSelectionActions,
            // fetch
        );
    }
    try {

        return <a href="#" onClick={() => alert("hi")}>{value}</a>
        }
        catch(e) {
        return <span>error</span>
        }
}
export const useColumnRenderers = (
    columnList = [],
) => {

    return useMemo(() => columnList
        .map(col => {
            return {
                ...col,
                dataIndex: col.dataIndex === "assetId" ? "name" : col.dataIndex,
                key: col.key || col.title,
                pinned: col.fixed || col.pinned,
                Cell: MyCell
            };
        }), []);
};
