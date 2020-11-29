import React, {useState, useMemo} from "react";
import styled from "styled-components";
import {getFormattedLocalDatetime} from "./time";

const priorityRenderer = (value, row) => {
    return value
}

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


export const columnRenderers = {
    priorityRenderer,
    booleanRenderer,
    dateRenderer
};

