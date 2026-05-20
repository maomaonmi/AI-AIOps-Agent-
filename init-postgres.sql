-- 创建 CMDB 表结构

-- 服务器资产表
CREATE TABLE IF NOT EXISTS servers (
    id SERIAL PRIMARY KEY,
    hostname VARCHAR(100) NOT NULL,
    ip_address VARCHAR(50) NOT NULL,
    os_type VARCHAR(50),
    cpu_cores INT,
    memory_gb INT,
    disk_gb INT,
    status VARCHAR(20) DEFAULT 'running',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 应用服务表
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    server_id INT REFERENCES servers(id),
    port INT,
    protocol VARCHAR(10),
    status VARCHAR(20) DEFAULT 'running',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 告警记录表
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    alert_name VARCHAR(200) NOT NULL,
    severity VARCHAR(20),
    status VARCHAR(20) DEFAULT 'firing',
    description TEXT,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE
);

-- 变更工单表
CREATE TABLE IF NOT EXISTS change_tickets (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    requester VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入示例数据
INSERT INTO servers (hostname, ip_address, os_type, cpu_cores, memory_gb, disk_gb, status) VALUES
('web-server-01', '192.168.1.10', 'CentOS 7', 8, 32, 500, 'running'),
('web-server-02', '192.168.1.11', 'CentOS 7', 8, 32, 500, 'running'),
('db-server-01', '192.168.1.20', 'Ubuntu 20.04', 16, 64, 2000, 'running'),
('cache-server-01', '192.168.1.30', 'Ubuntu 20.04', 4, 16, 100, 'running'),
('lb-server-01', '192.168.1.5', 'CentOS 7', 4, 8, 100, 'running')
ON CONFLICT DO NOTHING;

INSERT INTO services (name, server_id, port, protocol, status) VALUES
('nginx', 1, 80, 'tcp', 'running'),
('nginx', 2, 80, 'tcp', 'running'),
('postgresql', 3, 5432, 'tcp', 'running'),
('redis', 4, 6379, 'tcp', 'running'),
('haproxy', 5, 443, 'tcp', 'running')
ON CONFLICT DO NOTHING;

INSERT INTO alerts (alert_name, severity, status, description) VALUES
('HighCPUUsage', 'warning', 'firing', 'CPU usage exceeded 80% for 5 minutes'),
('HighMemoryUsage', 'critical', 'firing', 'Memory usage exceeded 90%'),
('DiskSpaceLow', 'warning', 'resolved', 'Disk usage exceeded 85%'),
('ServiceDown', 'critical', 'resolved', 'Service nginx on web-server-02 is down')
ON CONFLICT DO NOTHING;
