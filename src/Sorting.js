import {
  isEmpty,
  isObject,
  isNumber,
  isString,
  sortBy,
  maxBy,
  isArray
} from "lodash";
// import { safeJsonParse } from "~/utils";
// import { determinePath, parseLinkValue } from "./selectors";
// import { getIndexOfFirstNoneNumber } from "~/utils/string";
// import { getUTC } from "~/utils/time";
// import { isBlank } from "~/utils/forms";
// import moment from "moment";

const DATA_TYPES = {
  1: "Float",
  2: "Integer",
  3: "String",
  4: "State",
  5: "Location",
  6: "Bit",
  7: "Date"
};

const isIncompleteNumber = (str) => {
  return str === "-" || str === ".";
};

//called in the case where one of the values being compared is . or -
const sortIncompleteNumber = (rightValue, leftValue, inverted) => {
  if (isIncompleteNumber(rightValue) && !isIncompleteNumber(leftValue)) {
    return inverted ? 1 : -1;
  } else if (!isIncompleteNumber(rightValue) && isIncompleteNumber(leftValue)) {
    return inverted ? -1 : 1;
  } else if (isIncompleteNumber(rightValue) && isIncompleteNumber(leftValue)) {
    return 0;
  }
};

const sortNumber = (leftValue, rightValue) => {
  const leftNumber = isNumber(leftValue)
      ? leftValue
      : parseFloat(leftValue.replace(/[^\d.-]/g, "")),
    rightNumber = isNumber(rightValue)
      ? rightValue
      : parseFloat(rightValue.replace(/[^\d.-]/g, ""));

  if (!isNaN(leftNumber) && !isNaN(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return isNaN(leftNumber) ? 1 : -1;
};

const determineValueType = (value) => {
  if (isBlank(value) || isIncompleteNumber(value)) {
    return;
  }

  const index = getIndexOfFirstNoneNumber(value);
  switch (index) {
    case -1:
      return "number";
    case 0:
      return "string";
    default:
      return "mixed";
  }
};

const determineFilterType = (rows = [], columnId) => {
  const values = { string: 0, number: 0, mixed: 0 };
  for (const index in rows) {
    const value = rows[index] ? rows[index][columnId] : null;

    const valueType = determineValueType(value);
    if (valueType) {
      values[valueType]++;
      if (values[valueType] > 50) {
        break;
      }
    }
  }
  const largestFilter = maxBy(Object.keys(values), (v) => values[v]);
  if (
    values[largestFilter] > values.string * 1.5 ||
    values[largestFilter] > values.number * 1.5
  ) {
    return largestFilter;
  }
  return "mixed";
};

const getStringValue = (data) => {
  if (typeof data === "string") return data;
  return !isEmpty(data) ? data.value : null;
};

const getNumberValue = (data) => {
  if (isBlank(data) || isIncompleteNumber(data)) {
    return null;
  }

  const numberValue =
    typeof data === "string" ? parseFloat(data.replace(/,/g, "")) : data;

  if (!isNaN(numberValue)) {
    return numberValue;
  }

  const splitIndex = getIndexOfFirstNoneNumber(data);
  if (splitIndex) {
    return parseFloat(data.substring(0, splitIndex));
  }

  return null;
};

const defaultCompareFn = (leftRow, rightRow, columnId, inverted) => {
  const leftValue = leftRow.values[columnId];
  const rightValue = rightRow.values[columnId];
  const dataTypeName = DATA_TYPES[leftRow.valuesType];
  //check if values are just - or . in that case push - or . to end of sorted list via sortIncompleteNumber call
  if (isIncompleteNumber(leftValue) || isIncompleteNumber(rightValue)) {
    return sortIncompleteNumber(rightValue, leftValue, inverted);
  }

  const strippedLeftValue =
      typeof leftValue === "string" ? leftValue.replace(/,/g, "") : leftValue,
    strippedRightValue =
      typeof rightValue === "string"
        ? rightValue.replace(/,/g, "")
        : rightValue;

  // determine if string, number, mixed
  const leftSplitIndex = getIndexOfFirstNoneNumber(strippedLeftValue),
    rightSplitIndex = getIndexOfFirstNoneNumber(strippedRightValue);

  if (leftSplitIndex < 0 || rightSplitIndex < 0) {
    // one value is a pure number
    const leftNumber =
      typeof strippedLeftValue === "string"
        ? parseFloat(strippedLeftValue)
        : strippedLeftValue;
    const rightNumber =
      typeof strippedRightValue === "string"
        ? parseFloat(strippedRightValue)
        : strippedRightValue;

    if (typeof leftRow === "boolean") {
      return leftRow === rightRow ? 0 : leftRow ? -1 : 1;
    }

    if (
      dataTypeName === "Float" ||
      dataTypeName === "Integer" ||
      !isNaN(leftNumber) ||
      !isNaN(rightNumber)
    ) {
      return sortNumber(leftNumber, rightNumber);
    }
  } else if (leftSplitIndex > 0 || rightSplitIndex > 0) {
    // at least one value is a string starting with a number
    // compare numbers then strings
    const numberComparison = sortNumber(
      strippedLeftValue.substring(0, leftSplitIndex),
      strippedRightValue.substring(0, rightSplitIndex)
    );
    if (numberComparison) {
      return numberComparison;
    }

    const leftString = strippedLeftValue.substring(leftSplitIndex),
      rightString = strippedRightValue.substring(rightSplitIndex);
    return leftString.localeCompare(rightString);
  }

  // both are strings
  if (typeof leftRow === "string") {
    return leftRow.localeCompare(rightRow);
  }

  if (leftRow.valuesType > 2 || rightRow.valuesType > 2) {
    return leftValue.localeCompare(rightValue);
  }

  return Number(leftValue) - Number(rightValue);
};

export const defaultComparator = (col, rows) => {
  const type = col.filterType || determineFilterType(rows, col.valuesIndex);

  return {
    comparator: (leftRow = {}, rightRow = {}, _, __, inverted) => {
      const leftValue = isObject(leftRow) ? leftRow.value : leftRow,
        rightValue = isObject(rightRow) ? rightRow.value : rightRow;
      if (isBlank(leftValue) && isBlank(rightValue)) {
        return 0;
      } else if (isBlank(rightValue)) {
        return inverted ? 1 : -1;
      } else if (isBlank(leftValue)) {
        return inverted ? -1 : 1;
      } else {
        return defaultCompareFn(leftRow, rightRow, col.id, inverted, type);
      }
    },
    type,
    filterValueGetter: (data) => {
      switch (type) {
        case "number":
          return getNumberValue(data);
        case "mixed":
          return {
            number: getNumberValue(data),
            text: getStringValue(data)
          };
        default:
          return getStringValue(data);
      }
    }
  };
};

const stripSpecial = (str) =>
  isString(str) ? str.slice(0).replace(/[^\w\s]/gi, "") : "";

const renderClasses = (_col, _rows) => ({
  comparator: (leftClasses, rightClasses) => {
    if (isEmpty(leftClasses)) {
      return -1;
    }
    if (isEmpty(rightClasses)) {
      return 1;
    }
    return leftClasses
      .map((c) => c.name)
      .join("")
      .localeCompare(rightClasses.map((c) => c.name).join(""));
  },
  type: "string",
  filterValueGetter: (classes = []) => {
    return classes.map((c) => c.name).join("");
  }
});

const renderAsset = (_col, _rows) => ({
  comparator: (_, __, { data: leftAsset }, { data: rightAsset }) => {
    if (!leftAsset.name) return 1;
    if (!rightAsset.name) return -1;
    return leftAsset.name.localeCompare(rightAsset.name);
  }
});

const markdownRenderer = (_col, _rows) => ({
  comparator: (leftString, rightString) => {
    return stripSpecial(leftString).localeCompare(stripSpecial(rightString));
  }
});

const linkRenderer = (col, rows) => {
  const parsedData = rows.map((row) => {
      const value = parseLinkValue(row[col.valuesIndex]).parsedValue;
      return isArray(value) ? value[0] : value;
    }),
    type = col.filterType || determineFilterType(parsedData, "label");

  return {
    comparator: (leftValueStr, rightValueStr, _, __, inverted) => {
      const { links: leftValue } = parseLinkValue(leftValueStr),
        { links: rightValue } = parseLinkValue(rightValueStr);

      if (leftValue.length === 0 && rightValue.length === 0) {
        return 0;
      }
      if (leftValue.length === 0) {
        return inverted ? -1 : 1;
      }
      if (rightValue.length === 0) {
        return inverted ? 1 : -1;
      }
      const leftSortValue = leftValue[0].label || leftValue[0].statusCode,
        rightSortValue = rightValue[0].label || rightValue[0].statusCode;
      return defaultCompareFn(
        leftSortValue,
        rightSortValue,
        leftSortValue,
        rightSortValue,
        inverted,
        type
      );
    },
    type,
    filterValueGetter: (valueStr = []) => {
      const parsed = parseLinkValue(valueStr);
      if (!parsed || !parsed.links) {
        return "";
      }

      switch (type) {
        case "number": {
          const data =
            isArray(parsed.links) && parsed.links[0]
              ? parsed.links[0].name || parsed.links[0].label
              : null;
          return getNumberValue(data);
        }
        case "mixed": {
          const numberData =
            isArray(parsed.links) && parsed.links[0]
              ? parsed.links[0].name || parsed.links[0].label
              : null;
          const stringData = parsed.links
            .map((c) => c.name || c.label)
            .join("");
          return {
            number: getNumberValue(numberData),
            text: getStringValue(stringData)
          };
        }
        default: {
          const data = parsed.links.map((c) => c.name || c.label).join("");
          return getStringValue(data);
        }
      }
    }
  };
};

const pathRenderer = (_col, _rows) => ({
  comparator: (_, __, { data: leftValue }, { data: rightValue }, inverted) => {
    const leftEntityType = leftValue.sourceTypeIcon,
      rightEntityType = rightValue.sourceTypeIcon,
      leftPath = determinePath(leftValue, leftEntityType),
      rightPath = determinePath(rightValue, rightEntityType);

    if (!leftPath) return inverted ? -1 : 1;
    if (!rightPath) return inverted ? 1 : -1;
    return leftPath.toLowerCase().localeCompare(rightPath.toLowerCase());
  },
  filterValueGetter: (data, row) => {
    if (!data) return determinePath(row, row.sourceTypeIcon);

    if (typeof data === "string") return data;
    return !isEmpty(data) ? data.value : null;
  }
});

const dateRenderer = (_col, _rows) => ({
  comparator: (leftValue, rightValue, _, __, inverted) => {
    if (!leftValue) return inverted ? -1 : 1;
    if (!rightValue) return inverted ? 1 : -1;

    const leftDate = getUTC(leftValue),
      rightDate = getUTC(rightValue);

    return rightDate - leftDate;
  },
  type: "date",
  filterValueGetter: (data) => {
    const momentDate = moment(data);
    return momentDate.isValid() ? momentDate : moment(getUTC(data));
  }
});

const customDateRenderer = (_col, _rows) => ({
  comparator: (leftValue, rightValue, _, __, inverted) => {
    if (!leftValue) return inverted ? -1 : 1;
    if (!rightValue) return inverted ? 1 : -1;

    const leftDate = moment(leftValue),
      rightDate = moment(rightValue);
    return leftDate.isBefore(rightDate) ? 1 : -1;
  },
  type: "date",
  filterValueGetter: (data) => {
    const momentDate = moment(data);
    return momentDate.isValid() ? momentDate : null;
  }
});

const conversationRenderer = (_col, _rows) => ({
  type: "number"
});

const multiplePathRenderer = (_col, _rows) => ({
  comparator: (_, __, { data: leftValue }, { data: rightValue }, inverted) => {
    const leftPath = sortBy(safeJsonParse(leftValue.path, []), (path) =>
        path.toLowerCase()
      ).join(","),
      rightPath = sortBy(safeJsonParse(rightValue.path, []), (path) =>
        path.toLowerCase()
      ).join(",");

    if (!leftPath) return inverted ? -1 : 1;
    if (!rightPath) return inverted ? 1 : -1;
    return leftPath.toLowerCase().localeCompare(rightPath.toLowerCase());
  },
  filterValueGetter: (data, row) => {
    if (!data) return safeJsonParse(row.path, []).join(",");

    if (typeof data === "string") return data;
    return !isEmpty(data) ? data.value : null;
  }
});

const assetInstancesRenderer = (_col, _rows) => (
  leftRow,
  rightRow,
  columnId,
  inverted
) => {
  const leftValue = leftRow[columnId];
  const rightValue = rightRow[columnId];
  // For Threads table: we look at row.definitionLevel === "Class"
  // For Models table: we look at row.isClas
  const isLeftClass =
      leftRow.values.isClass || leftRow.values.definitionLevel === "Class",
    isRightClass =
      rightRow.values.isClass || rightRow.values.definitionLevel === "Class",
    defaultComparator = () =>
      defaultCompareFn(leftRow, rightRow, columnId, inverted, "number");

  if (isLeftClass) {
    if (isRightClass) {
      return defaultComparator();
    }
    return -1;
  }
  if (isRightClass) {
    return 1;
  }
  return defaultComparator();
};

const nameRenderer = (rowA, rowB, columnId, inverted) => {
  const comparison = (rowA.values[columnId] || "").localeCompare(
    rowB.values[columnId] || ""
  );

  return comparison;
};

export const sortTypes = {
  nameRenderer,
  markdownRenderer,
  renderClasses,
  renderAsset,
  linkRenderer,
  pathRenderer,
  dateRenderer,
  customDateRenderer,
  conversationRenderer,
  multiplePathRenderer,
  assetInstancesRenderer
};
