"""StoryForge Server 配置"""
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")

# 新建工程的默认存储根目录：StoryForge/projects，自动生成 <项目名> 文件夹
DEFAULT_STORAGE_ROOT = os.path.join(os.path.dirname(BASE_DIR), "projects")

for d in (DATA_DIR, DEFAULT_STORAGE_ROOT):
    os.makedirs(d, exist_ok=True)

HOST = "127.0.0.1"
PORT = 8790
