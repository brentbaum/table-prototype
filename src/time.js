import moment from "moment";

export const DATE_FORMAT = "DD-MMM-YY";
export const TIME_FORMAT = "DD-MMM-YY HH:mm";

export const parseDotNETDateString = dateString => {
    return dateString && dateString.indexOf("(") >= 0
        ? new Date(Number(dateString.slice(6, -2)))
        : new Date(dateString);
};

export const getUTC = time => {
    if (!time) return null;
    if (
        time
            .toString()
            .toLowerCase()
            .includes("date")
    ) {
        return time.match(/\d+/)[0] * 1;
    }
    const momentDate = moment.utc(
        time,
        [moment.ISO_8601, "DD-MMM-YY HH:mm:ss"],
        true
    );
    if (momentDate.isValid()) {
        return momentDate.valueOf();
    }
    return new Date(Number(time)).getTime();
};

const calendarFormat = {
    lastWeek: "[Last] dddd [at] HH:mm",
    lastDay: "[Yesterday] [at] HH:mm",
    sameDay: "[Today] [at] HH:mm",
    nextDay: "[Tomorrow] [at] HH:mm",
    nextWeek: "dddd [at] HH:mm",
    sameElse: TIME_FORMAT
};

export const getFormattedLocalDatetime = (timeValue, format = "calendar") => {
    const utcTime = getUTC(timeValue);

    const time = moment.utc(utcTime).local();
    if (format === "time") {
        return time.format("HH:mm");
    }
    if (format === "date") {
        return time.format("dddd, MMM Do");
    }
    if (format === "datetime") return time.format(TIME_FORMAT);
    if (format === "simpledateformat") return time.format("DD-MMM-YY HH:mm:ss");
    if (format === "fulldate") {
        return moment(time).isBefore(moment.now(), "year") ||
        moment(time).isAfter(moment.now(), "year")
            ? time.format("dddd, MMM Do, YYYY")
            : time.format("dddd, MMM Do");
    }
    return time.calendar(null, calendarFormat);
};

export const convertTTTimeToISO = time => {
    return new Date(
        Number(time.replace("/Date(", "").replace(")/", ""))
    ).toISOString();
};
