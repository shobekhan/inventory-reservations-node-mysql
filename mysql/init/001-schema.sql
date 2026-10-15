CREATE TABLE IF NOT EXISTS inventory_items (
  shop_id VARCHAR(100) NOT NULL,
  inventory_item_id VARCHAR(100) NOT NULL,
  total_quantity INT NOT NULL,
  PRIMARY KEY (shop_id, inventory_item_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS reservation_units (
  shop_id VARCHAR(100) NOT NULL,
  inventory_item_id VARCHAR(100) NOT NULL,
  inventory_group_id BIGINT NOT NULL,
  unit_id BIGINT NOT NULL,
  reservation_id CHAR(36) NULL,
  reserved_until DATETIME(6) NULL,
  PRIMARY KEY (shop_id, inventory_item_id, inventory_group_id, unit_id),
  INDEX idx_available (shop_id, inventory_item_id, reservation_id, reserved_until)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS reservations (
  id CHAR(36) NOT NULL,
  shop_id VARCHAR(100) NOT NULL,
  inventory_item_id VARCHAR(100) NOT NULL,
  quantity INT NOT NULL,
  status ENUM('reserved','claimed','released','expired') NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id)
) ENGINE=InnoDB;
