import json
import glob
import os
import sys

# 从配置文件读取课程列表以建立 source_file -> course_id 映射
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(SCRIPT_DIR, "courses_config.json")
COURSE_MAPPING = {}
if os.path.exists(CONFIG_FILE):
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            courses = json.load(f)
            for c in courses:
                if c.get("course_name") and c.get("course_id"):
                    COURSE_MAPPING[c["course_name"]] = c["course_id"]
    except Exception as e:
        print(f"❌ 读取配置文件 {CONFIG_FILE} 失败: {e}")
        sys.exit(1)
else:
    print(f"❌ 缺少配置文件 {CONFIG_FILE}！")
    sys.exit(1)

def get_homework_url(source_file, homework_id):
    if not homework_id:
        return None
    # 匹配课程 ID
    course_id = ""
    for name, cid in COURSE_MAPPING.items():
        if name in source_file:
            course_id = cid
            break
            
    if not course_id:
        return None
        
    # 匹配作业类型生成具体 URL
    if "PictureHomework" in source_file:
        return f"https://www.educoder.net/classrooms/{course_id}/common_homework/{homework_id}/detail"
    elif "Classwork" in source_file or "classwork" in source_file:
        return f"https://www.educoder.net/classrooms/{course_id}/shixun_homework/{homework_id}/detail?tabs=1"
        
    return None

def process_homework_data():
    # 自动获取当前目录下所有以 _result.json 结尾的文件
    files_to_process = glob.glob("*_result.json")
    
    if not files_to_process:
        print("当前目录下没有找到任何以 _result.json 结尾的文件。")
        sys.exit(1)

    processed_data = []

    # 遍历每个文件进行处理
    for file_name in files_to_process:
        print(f"[*] 正在处理: {file_name}")
        
        # 检查文件是否匹配当前配置的课程，避免读取已移除学科的残留文件
        matched_course = False
        for name in COURSE_MAPPING.keys():
            if name in file_name:
                matched_course = True
                break
        
        if not matched_course:
            print(f"    [!] 发现未匹配的残留文件或无效作业 {file_name}，已跳过清理。")
            try:
                os.remove(file_name) # 顺手清理掉残留的旧文件
            except OSError:
                pass
            continue

        with open(file_name, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                print(f"    [!] 解析 {file_name} 失败，非标准JSON，已跳过。")
                continue
        
        # 提取 homeworks 列表中的每一项
        homeworks = data.get("homeworks", [])
        for hw in homeworks:
            # 提取所需的特定标签（这里用 get 方法，以防某些类型作业缺少字段报错）
            homework_id = hw.get("homework_id")
            homework_url = get_homework_url(file_name, homework_id)
            
            # 1. 整理易读的 source_name
            source_name = ""
            for name in COURSE_MAPPING.keys():
                if name in file_name:
                    source_name = name
                    break
            
            if "PictureHomework" in file_name: source_name += "【图文作业】"
            elif "Classwork" in file_name or "classwork" in file_name: source_name += "【课堂实验】"
            else:
                if not source_name:
                    source_name = file_name
            
            # 2. 判断完成状态：0为未提交，1为已完成/已提交
            completion_status = 0
            if hw.get("shixun_finished_status") == 1:
                # 课堂实验完成 或 图文作业特例完成
                completion_status = 1
            else:
                work_status = hw.get("work_status")
                if work_status and isinstance(work_status, list) and len(work_status) > 0:
                    ws_str = work_status[0]
                    # "修改作品"/"修改作业" 或 "查看作品"（已截止且有作业）均认定为已提交
                    if "修改" in ws_str or "查看" in ws_str:
                        completion_status = 1
                    # "提交作品" 一般意味着还没交
                    elif "提交" in ws_str:
                        completion_status = 0

            simplified_hw = {
                "source_file": source_name,
                "name": hw.get("name"),
                "end_time_s": hw.get("end_time_s"),
                "homework_url": homework_url,
                "completion_status": completion_status
            }
            processed_data.append(simplified_hw)

    output_filename = "homeworks_summary.json"
    
    # 写入新文件
    with open(output_filename, 'w', encoding='utf-8') as f:
        json.dump(processed_data, f, ensure_ascii=False, indent=4)
        
    print(f"\n✅ 所有数据处理完毕！共提取了 {len(processed_data)} 个作业，已保存为 {output_filename}")

if __name__ == "__main__":
    process_homework_data()
