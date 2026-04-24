import json
from datetime import datetime
import sys

def filter_and_sort_homeworks(input_file="homeworks_summary.json", output_file="upcoming_homeworks.json"):
    # 1. 读取初始 summary 数据
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            homeworks = json.load(f)
    except FileNotFoundError:
        print(f"❌ 未找到文件 {input_file}，请先运行数据处理脚本。")
        sys.exit(1)

    # 2. 获取当前时间
    now = datetime.now()
    print(f"[*] 当前时间: {now.strftime('%Y-%m-%d %H:%M:%S')}")

    upcoming_homeworks = []
    
    # 3. 筛选出截止时间在当前时间之后的作业
    for hw in homeworks:
        end_time_str = hw.get("end_time_s")
        if end_time_str:
            try:
                # 解析时间字符串为 datetime 对象
                end_time = datetime.strptime(end_time_str, "%Y-%m-%d %H:%M:%S")
                # 仅保留尚未截止的作业
                if end_time > now:
                    upcoming_homeworks.append(hw)
            except ValueError:
                print(f"[!] 时间格式解析异常，跳过此条目: {end_time_str}")
    
    # 4. 对剩余的作业按截止时间排序（距离当前时间越近，排在越前面，即升序排列）
    upcoming_homeworks.sort(key=lambda x: datetime.strptime(x["end_time_s"], "%Y-%m-%d %H:%M:%S"))

    # 5. 生成新的 json 文件
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(upcoming_homeworks, f, ensure_ascii=False, indent=4)
        
    print(f"✅ 筛选排序完成！共找到 {len(upcoming_homeworks)} 个待完成作业。")
    print(f"✅ 结果已保存至: {output_file}")

if __name__ == "__main__":
    filter_and_sort_homeworks()
