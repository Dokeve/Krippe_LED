function createSchemaSQL(dbName){
return `
CREATE TABLE IF NOT EXISTS ${dbName}.calendar (
  id INT AUTO_INCREMENT PRIMARY KEY,
  start DATETIME NOT NULL,
  end DATETIME NOT NULL,
  module TINYINT NOT NULL,
  weekly TINYINT DEFAULT 0,
  created_at DATETIME
);

CREATE TABLE IF NOT EXISTS ${dbName}.led_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  ledFrom INT, ledTo INT, count INT,
  wall TINYINT DEFAULT 0,
  dayColor VARCHAR(16),
  nightColor VARCHAR(16),
  startTime INT DEFAULT 0,
  endTime INT DEFAULT 0,
  scenario VARCHAR(32) DEFAULT 'Tag'
);

CREATE TABLE IF NOT EXISTS ${dbName}.speech (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  startDate DATE,
  endDate DATE,
  file VARCHAR(512)
);

CREATE TABLE IF NOT EXISTS ${dbName}.bg_map (
  scenario VARCHAR(32) PRIMARY KEY,
  file VARCHAR(512)
);
`;
}
module.exports = { createSchemaSQL };
