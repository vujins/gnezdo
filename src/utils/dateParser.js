
const dateRegex = /(\d+)\.(\d+)\.(\d+) u (\d+\:\d+)/;


const parseDate = (s) => {
  if (!s) return null;

  const rez = dateRegex.exec(s);

  if (!rez) return null;

  const day = rez[1];
  const month = rez[2];
  const year = rez[3];
  const time = rez[4];

  const returnDate = Date.parse(`${year}-${month}-${day}T${time}:00`);

  return returnDate;
};

module.exports = parseDate;
