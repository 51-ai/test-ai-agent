/**
 * 系统性能数据读取工具
 * 读取 Windows 任务管理器的性能数据
 */
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TaskManagerMetrics {
  // CPU 信息
  cpu: {
    usage: number;           // CPU 使用率 (%)
    cores: number;            // CPU 核心数
    speed: number;           // CPU 速度 (GHz)
    temperature?: number;     // CPU 温度 (如果可用)
    name: string;            // CPU 名称
  };
  
  // 内存信息
  memory: {
    total: number;           // 总内存 (GB)
    used: number;           // 已使用 (GB)
    available: number;       // 可用 (GB)
    usagePercent: number;   // 使用率 (%)
    cached: number;         // 已缓存 (GB)
  };
  
  // 磁盘信息
  disk: {
    total: number;          // 总大小 (GB)
    used: number;           // 已使用 (GB)
    free: number;           // 可用 (GB)
    usagePercent: number;  // 使用率 (%)
    readSpeed: number;      // 读取速度 (MB/s)
    writeSpeed: number;     // 写入速度 (MB/s)
  };
  
  // 网络信息
  network: {
    adapter: string;         // 适配器名称
    bytesReceived: number;   // 接收字节数
    bytesSent: number;      // 发送字节数
    speed: number;          // 网络速度 (Mbps)
    latency: number;        // 网络延迟 (ms)
  };
  
  // GPU 信息 (如果可用)
  gpu?: {
    name: string;
    usage: number;          // GPU 使用率 (%)
    memoryUsed: number;     // 已用显存 (MB)
    memoryTotal: number;    // 总显存 (MB)
    temperature: number;    // GPU 温度
  };
  
  // 进程信息
  processes: {
    count: number;          // 进程总数
    topProcesses: Array<{
      name: string;
      pid: number;
      cpu: number;
      memory: number;
    }>;
  };
  
  // 系统信息
  system: {
    uptime: number;         // 运行时间 (秒)
    os: string;             // 操作系统版本
    platform: string;       // 平台
    hostname: string;       // 主机名
  };
  
  timestamp: Date;
}

/**
 * 执行 PowerShell 命令并返回结果
 */
async function runPowerShell(command: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`powershell -Command "${command}"`, {
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });
    return stdout.trim();
  } catch (error) {
    console.error('PowerShell execution error:', error);
    throw error;
  }
}

/**
 * 解析 CPU 使用率
 */
async function getCpuMetrics(): Promise<TaskManagerMetrics['cpu']> {
  try {
    // 获取 CPU 使用率和核心数
    const cpuUsage = await runPowerShell(
      "(Get-Counter '\\Processor(_Total)\\% Processor Time').CounterSamples.CookedValue"
    );
    
    const cpuInfo = await runPowerShell(
      `Get-CimInstance Win32_Processor | Select-Object -Property Name, NumberOfCores, MaxClockSpeed | ConvertTo-Json`
    );
    
    const usage = parseFloat(cpuUsage) || 0;
    const info = JSON.parse(cpuInfo);
    
    return {
      usage: Math.round(usage * 100) / 100,
      cores: info.NumberOfCores || 1,
      speed: (info.MaxClockSpeed || 0) / 1000,
      name: info.Name || 'Unknown CPU'
    };
  } catch (error) {
    // 备用方案：使用简单的 CPU 获取方式
    try {
      const cpuUsage = await runPowerShell(
        "(Get-CimInstance Win32_Processor).LoadPercentage"
      );
      return {
        usage: parseInt(cpuUsage) || 0,
        cores: require('os').cpus().length,
        speed: 0,
        name: 'CPU'
      };
    } catch {
      return {
        usage: 0,
        cores: require('os').cpus().length,
        speed: 0,
        name: 'CPU'
      };
    }
  }
}

/**
 * 获取内存信息
 */
async function getMemoryMetrics(): Promise<TaskManagerMetrics['memory']> {
  try {
    const memInfo = await runPowerShell(
      `Get-CimInstance Win32_OperatingSystem | Select-Object -Property TotalVisibleMemorySize, FreePhysicalMemory, TotalVirtualMemorySize, FreeVirtualMemory | ConvertTo-Json`
    );
    
    const info = JSON.parse(memInfo);
    const totalKB = info.TotalVisibleMemorySize || 0;
    const freeKB = info.FreePhysicalMemory || 0;
    const totalGB = totalKB / 1024 / 1024;
    const freeGB = freeKB / 1024 / 1024;
    const usedGB = totalGB - freeGB;
    
    return {
      total: Math.round(totalGB * 100) / 100,
      used: Math.round(usedGB * 100) / 100,
      available: Math.round(freeGB * 100) / 100,
      usagePercent: Math.round((usedGB / totalGB) * 10000) / 100,
      cached: 0
    };
  } catch (error) {
    // 备用方案
    const os = require('os');
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      total: Math.round(totalMem / 1024 / 1024 / 1024 * 100) / 100,
      used: Math.round(usedMem / 1024 / 1024 / 1024 * 100) / 100,
      available: Math.round(freeMem / 1024 / 1024 / 1024 * 100) / 100,
      usagePercent: Math.round((usedMem / totalMem) * 10000) / 100,
      cached: 0
    };
  }
}

/**
 * 获取磁盘信息
 */
async function getDiskMetrics(): Promise<TaskManagerMetrics['disk']> {
  try {
    const diskInfo = await runPowerShell(
      `Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object -Property DeviceID, Size, FreeSpace | ConvertTo-Json`
    );
    
    const disks = JSON.parse(diskInfo);
    const diskArray = Array.isArray(disks) ? disks : [disks];
    
    // 获取主磁盘 (C:)
    const mainDisk = diskArray.find((d: any) => d.DeviceID === 'C:') || diskArray[0];
    
    if (!mainDisk) {
      throw new Error('No disk found');
    }
    
    const totalGB = (mainDisk.Size || 0) / 1024 / 1024 / 1024;
    const freeGB = (mainDisk.FreeSpace || 0) / 1024 / 1024 / 1024;
    const usedGB = totalGB - freeGB;
    
    return {
      total: Math.round(totalGB * 100) / 100,
      used: Math.round(usedGB * 100) / 100,
      free: Math.round(freeGB * 100) / 100,
      usagePercent: Math.round((usedGB / totalGB) * 10000) / 100,
      readSpeed: 0,
      writeSpeed: 0
    };
  } catch (error) {
    return {
      total: 0,
      used: 0,
      free: 0,
      usagePercent: 0,
      readSpeed: 0,
      writeSpeed: 0
    };
  }
}

/**
 * 获取网络信息
 */
async function getNetworkMetrics(): Promise<TaskManagerMetrics['network']> {
  try {
    const netInfo = await runPowerShell(
      `Get-NetAdapterStatistics | Where-Object { $_.ReceivedBytes -gt 0 } | Select-Object -Property Name, ReceivedBytes, SentBytes | ConvertTo-Json`
    );
    
    const adapters = JSON.parse(netInfo);
    const adapterArray = Array.isArray(adapters) ? adapters : [adapters];
    const mainAdapter = adapterArray[0];
    
    if (!mainAdapter) {
      throw new Error('No network adapter found');
    }
    
    return {
      adapter: mainAdapter.Name || 'Network',
      bytesReceived: mainAdapter.ReceivedBytes || 0,
      bytesSent: mainAdapter.SentBytes || 0,
      speed: 100, // 默认 100 Mbps
      latency: 0
    };
  } catch (error) {
    return {
      adapter: 'Network',
      bytesReceived: 0,
      bytesSent: 0,
      speed: 100,
      latency: 0
    };
  }
}

/**
 * 获取 GPU 信息
 */
async function getGpuMetrics(): Promise<TaskManagerMetrics['gpu'] | undefined> {
  try {
    // 尝试使用 WMI 获取 GPU 信息
    const gpuInfo = await runPowerShell(
      `Get-CimInstance Win32_VideoController | Select-Object -Property Name, AdapterRAM, DriverVersion | ConvertTo-Json`
    );
    
    const gpus = JSON.parse(gpuInfo);
    const gpuArray = Array.isArray(gpus) ? gpus : [gpus];
    const mainGpu = gpuArray[0];
    
    if (!mainGpu) {
      return undefined;
    }
    
    return {
      name: mainGpu.Name || 'GPU',
      usage: 0, // WMI 不直接提供使用率
      memoryUsed: 0,
      memoryTotal: mainGpu.AdapterRAM ? mainGpu.AdapterRAM / 1024 / 1024 : 0,
      temperature: 0
    };
  } catch (error) {
    return undefined;
  }
}

/**
 * 获取进程信息
 */
async function getProcessMetrics(): Promise<TaskManagerMetrics['processes']> {
  try {
    const processList = await runPowerShell(
      `Get-Process | Sort-Object -Property CPU -Descending | Select-Object -First 10 -Property Name, Id, CPU, WorkingSet64 | ConvertTo-Json`
    );
    
    const processes = JSON.parse(processList);
    const processArray = Array.isArray(processes) ? processes : [processes];
    
    return {
      count: processArray.length,
      topProcesses: processArray.map((p: any) => ({
        name: p.Name || 'Unknown',
        pid: p.Id || 0,
        cpu: Math.round((p.CPU || 0) * 100) / 100,
        memory: Math.round((p.WorkingSet64 || 0) / 1024 / 1024) // MB
      }))
    };
  } catch (error) {
    return {
      count: 0,
      topProcesses: []
    };
  }
}

/**
 * 获取系统信息
 */
async function getSystemMetrics(): Promise<TaskManagerMetrics['system']> {
  try {
    const osInfo = await runPowerShell(
      `Get-CimInstance Win32_OperatingSystem | Select-Object -Property Caption, LastBootUpTime | ConvertTo-Json`
    );
    
    const info = JSON.parse(osInfo);
    
    // 处理 LastBootUpTime 格式 - 支持多种格式
    let uptimeSeconds = 0;
    if (info.LastBootUpTime) {
      try {
        const lastBootStr = info.LastBootUpTime;
        
        // 格式 1: JSON Date 格式 "/Date(1781309661500)/"
        const jsonDateMatch = lastBootStr.match(/\/Date\((\d+)\)\//);
        if (jsonDateMatch) {
          const lastBoot = new Date(parseInt(jsonDateMatch[1]));
          uptimeSeconds = Math.floor((Date.now() - lastBoot.getTime()) / 1000);
        }
        
        // 格式 2: WMI DateTime 格式 "20240612123456.000000+480"
        const wmiDateMatch = lastBootStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
        if (wmiDateMatch && uptimeSeconds === 0) {
          const [, year, month, day, hour, minute, second] = wmiDateMatch;
          const lastBoot = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hour),
            parseInt(minute),
            parseInt(second)
          );
          uptimeSeconds = Math.floor((Date.now() - lastBoot.getTime()) / 1000);
        }
        
        // 格式 3: ISO 日期字符串
        if (uptimeSeconds === 0) {
          const isoDate = new Date(lastBootStr);
          if (!isNaN(isoDate.getTime())) {
            uptimeSeconds = Math.floor((Date.now() - isoDate.getTime()) / 1000);
          }
        }
      } catch (e) {
        console.error('Error parsing uptime:', e);
      }
    }
    
    return {
      uptime: uptimeSeconds,
      os: info.Caption || 'Windows',
      platform: 'win32',
      hostname: require('os').hostname()
    };
  } catch (error) {
    return {
      uptime: 0,
      os: 'Windows',
      platform: 'win32',
      hostname: require('os').hostname()
    };
  }
}

/**
 * 获取完整的任务管理器性能数据
 */
export async function getTaskManagerMetrics(): Promise<TaskManagerMetrics> {
  try {
    const [cpu, memory, disk, network, gpu, processes, system] = await Promise.all([
      getCpuMetrics(),
      getMemoryMetrics(),
      getDiskMetrics(),
      getNetworkMetrics(),
      getGpuMetrics(),
      getProcessMetrics(),
      getSystemMetrics()
    ]);
    
    return {
      cpu,
      memory,
      disk,
      network,
      gpu,
      processes,
      system,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Error getting task manager metrics:', error);
    throw error;
  }
}

/**
 * 获取简化的系统性能数据 (用于快速轮询)
 */
export async function getQuickMetrics(): Promise<{
  cpu: number;
  memory: number;
  disk: number;
  timestamp: Date;
}> {
  try {
    const cpu = await getCpuMetrics();
    const memory = await getMemoryMetrics();
    const disk = await getDiskMetrics();
    
    return {
      cpu: cpu.usage,
      memory: memory.usagePercent,
      disk: disk.usagePercent,
      timestamp: new Date()
    };
  } catch (error) {
    return {
      cpu: 0,
      memory: 0,
      disk: 0,
      timestamp: new Date()
    };
  }
}

/**
 * 获取格式化的时间字符串
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}天 ${hours}小时 ${minutes}分钟`;
  } else if (hours > 0) {
    return `${hours}小时 ${minutes}分钟`;
  } else {
    return `${minutes}分钟`;
  }
}

/**
 * 获取内存使用状态
 */
export function getMemoryStatus(usagePercent: number): 'normal' | 'warning' | 'critical' {
  if (usagePercent >= 90) return 'critical';
  if (usagePercent >= 75) return 'warning';
  return 'normal';
}

/**
 * 获取 CPU 使用状态
 */
export function getCpuStatus(usage: number): 'normal' | 'warning' | 'critical' {
  if (usage >= 90) return 'critical';
  if (usage >= 75) return 'warning';
  return 'normal';
}
