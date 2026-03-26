-- Snackhouse POS schema (VAT disabled in app logic; column remains for compatibility)

CREATE TABLE IF NOT EXISTS categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  display_order INT DEFAULT 0,
  color VARCHAR(7) DEFAULT '#FFB6C1',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  category_id INT NOT NULL,
  base_price DECIMAL(10, 2) NOT NULL,
  product_type ENUM('made-to-order', 'finished-goods') DEFAULT 'made-to-order',
  has_variants BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS product_variants (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  variant_name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ingredients (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  cost_per_unit DECIMAL(10, 4) NOT NULL,
  servings_per_unit DECIMAL(10, 2) DEFAULT 1,
  supplier_name VARCHAR(255),
  reorder_level INT DEFAULT 1000,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ingredient_inventory (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ingredient_id INT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  max_capacity DECIMAL(10, 2) DEFAULT 10000,
  last_restocked TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
  UNIQUE KEY (ingredient_id)
);

CREATE TABLE IF NOT EXISTS inventory (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  reorder_level INT DEFAULT 10,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE KEY (product_id)
);

CREATE TABLE IF NOT EXISTS employees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(255) NOT NULL,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('cashier', 'manager') DEFAULT 'cashier',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS recipes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  variant_id INT,
  name VARCHAR(255) NOT NULL,
  instructions TEXT,
  prep_time_minutes INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recipe_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  recipe_id INT NOT NULL,
  ingredient_id INT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  employee_id INT NOT NULL,
  order_type ENUM('dine-in', 'takeout') DEFAULT 'takeout',
  subtotal DECIMAL(10, 2) NOT NULL,
  vat_amount DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'completed', 'voided') DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  variant_id INT,
  quantity INT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (variant_id) REFERENCES product_variants(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  payment_method ENUM('cash', 'gcash') NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL,
  change_given DECIMAL(10, 2) DEFAULT 0,
  reference_number VARCHAR(100),
  processed_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (processed_by) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ingredient_id INT,
  product_id INT,
  transaction_type ENUM('sale', 'restock', 'waste', 'adjustment') NOT NULL,
  quantity_change DECIMAL(10, 2) NOT NULL,
  quantity_before DECIMAL(10, 2) NOT NULL,
  quantity_after DECIMAL(10, 2) NOT NULL,
  reason VARCHAR(255),
  reference_id INT,
  performed_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_orders_date ON orders(created_at);
CREATE INDEX idx_orders_employee ON orders(employee_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_ingredient_inventory_ingredient ON ingredient_inventory(ingredient_id);
CREATE INDEX idx_inventory_transactions_date ON inventory_transactions(created_at);

