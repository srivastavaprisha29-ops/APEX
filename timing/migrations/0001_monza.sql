CREATE TABLE timing_revision (
  id TEXT PRIMARY KEY,
  fetched_at TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('OpenF1', 'fixture')),
  session_key INTEGER NOT NULL CHECK (session_key = 9590)
);
CREATE TABLE timing_entry (
  driver_number INTEGER PRIMARY KEY,
  driver TEXT NOT NULL,
  constructor TEXT NOT NULL
);
INSERT INTO timing_entry VALUES (1, 'Max Verstappen', 'Red Bull'), (4, 'Lando Norris', 'McLaren');
CREATE TABLE timing_lap (
  revision TEXT NOT NULL REFERENCES timing_revision(id),
  driver_number INTEGER NOT NULL REFERENCES timing_entry(driver_number),
  lap INTEGER NOT NULL CHECK (lap > 0),
  total INTEGER CHECK (total > 0),
  s1 INTEGER CHECK (s1 > 0),
  s2 INTEGER CHECK (s2 > 0),
  s3 INTEGER CHECK (s3 > 0),
  quality TEXT NOT NULL CHECK (quality IN ('complete', 'missing', 'inconsistent', 'pit_out')),
  PRIMARY KEY (revision, driver_number, lap)
);
CREATE TABLE timing_active (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  revision TEXT NOT NULL REFERENCES timing_revision(id)
);
