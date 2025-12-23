#!/bin/bash

# 检查配置文件是否存在
if [ ! -f "configs/config.yaml" ]; then
    echo "配置文件不存在，正在从模板创建..."
    cp configs/config.yaml.example configs/config.yaml
    echo "请编辑 configs/config.yaml 配置数据库和API密钥"
    exit 1
fi

# 创建日志目录
mkdir -p logs

# 运行服务器
echo "启动指标看板服务器..."
go run cmd/server/main.go

