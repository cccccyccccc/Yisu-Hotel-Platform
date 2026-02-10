import { View, Text } from '@tarojs/components'
import { useState, useEffect, useCallback } from 'react'
import './index.scss'

interface CalendarProps {
  visible: boolean
  checkInDate?: string
  checkOutDate?: string
  onClose: () => void
  onConfirm: (checkIn: string, checkOut: string) => void
}

interface DayItem {
  date: string
  day: number
  isCurrentMonth: boolean
  isDisabled: boolean
  isToday: boolean
  isCheckIn: boolean
  isCheckOut: boolean
  isInRange: boolean
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

// 格式化日期为 YYYY-MM-DD
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 解析日期字符串
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// 获取月份的天数
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

// 获取月份第一天是星期几
function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

export default function Calendar({ visible, checkInDate, checkOutDate, onClose, onConfirm }: CalendarProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [selectedCheckIn, setSelectedCheckIn] = useState(checkInDate || '')
  const [selectedCheckOut, setSelectedCheckOut] = useState(checkOutDate || '')
  const [selectStep, setSelectStep] = useState<'checkIn' | 'checkOut'>('checkIn')

  useEffect(() => {
    if (checkInDate) setSelectedCheckIn(checkInDate)
    if (checkOutDate) setSelectedCheckOut(checkOutDate)
  }, [checkInDate, checkOutDate])

  // 生成当月日历数据
  const generateCalendarDays = useCallback((): DayItem[] => {
    const days: DayItem[] = []
    const daysInMonth = getDaysInMonth(currentYear, currentMonth)
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
    const todayStr = formatDate(today)

    // 填充上月末的日期
    const prevMonthDays = getDaysInMonth(currentYear, currentMonth - 1)
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = prevMonthDays - i
      const date = formatDate(new Date(currentYear, currentMonth - 1, day))
      days.push({
        date,
        day,
        isCurrentMonth: false,
        isDisabled: true,
        isToday: false,
        isCheckIn: false,
        isCheckOut: false,
        isInRange: false
      })
    }

    // 填充当月日期
    for (let day = 1; day <= daysInMonth; day++) {
      const date = formatDate(new Date(currentYear, currentMonth, day))
      const dateObj = parseDate(date)
      const isDisabled = dateObj < today
      const isCheckIn = date === selectedCheckIn
      const isCheckOut = date === selectedCheckOut

      let isInRange = false
      if (selectedCheckIn && selectedCheckOut) {
        const checkIn = parseDate(selectedCheckIn)
        const checkOut = parseDate(selectedCheckOut)
        isInRange = dateObj > checkIn && dateObj < checkOut
      }

      days.push({
        date,
        day,
        isCurrentMonth: true,
        isDisabled,
        isToday: date === todayStr,
        isCheckIn,
        isCheckOut,
        isInRange
      })
    }

    // 填充下月初的日期
    const remainingDays = 42 - days.length
    for (let day = 1; day <= remainingDays; day++) {
      const date = formatDate(new Date(currentYear, currentMonth + 1, day))
      days.push({
        date,
        day,
        isCurrentMonth: false,
        isDisabled: true,
        isToday: false,
        isCheckIn: false,
        isCheckOut: false,
        isInRange: false
      })
    }

    return days
  }, [currentYear, currentMonth, selectedCheckIn, selectedCheckOut, today])

  // 切换到上一个月
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear(currentYear - 1)
      setCurrentMonth(11)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  // 切换到下一个月
  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear(currentYear + 1)
      setCurrentMonth(0)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  // 处理日期点击
  const handleDayClick = (dayItem: DayItem) => {
    if (dayItem.isDisabled || !dayItem.isCurrentMonth) return

    if (selectStep === 'checkIn') {
      setSelectedCheckIn(dayItem.date)
      setSelectedCheckOut('')
      setSelectStep('checkOut')
    } else {
      const checkInDate = parseDate(selectedCheckIn)
      const clickedDate = parseDate(dayItem.date)

      if (clickedDate <= checkInDate) {
        // 如果点击的日期在入住日期之前或当天，重新选择入住日期
        setSelectedCheckIn(dayItem.date)
        setSelectedCheckOut('')
        setSelectStep('checkOut')
      } else {
        setSelectedCheckOut(dayItem.date)
        setSelectStep('checkIn')
      }
    }
  }

  // 确认选择
  const handleConfirm = () => {
    if (selectedCheckIn && selectedCheckOut) {
      onConfirm(selectedCheckIn, selectedCheckOut)
      onClose()
    }
  }

  // 计算入住天数
  const getNights = (): number => {
    if (!selectedCheckIn || !selectedCheckOut) return 0
    const checkIn = parseDate(selectedCheckIn)
    const checkOut = parseDate(selectedCheckOut)
    return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
  }

  // 格式化显示日期
  const formatDisplayDate = (dateStr: string): string => {
    if (!dateStr) return '请选择'
    const date = parseDate(dateStr)
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  if (!visible) return null

  const days = generateCalendarDays()
  const nights = getNights()

  return (
    <View className="calendar-overlay" onClick={onClose}>
      <View className="calendar-container" onClick={(e) => e.stopPropagation()}>
        <View className="calendar-header">
          <Text className="calendar-title">选择入住日期</Text>
          <View className="calendar-close" onClick={onClose}>×</View>
        </View>

        <View className="calendar-selected">
          <View className={`calendar-selected-item ${selectStep === 'checkIn' ? 'active' : ''}`}>
            <Text className="label">入住</Text>
            <Text className="date">{formatDisplayDate(selectedCheckIn)}</Text>
          </View>
          <View className="calendar-selected-nights">
            {nights > 0 && <Text>{nights}晚</Text>}
          </View>
          <View className={`calendar-selected-item ${selectStep === 'checkOut' ? 'active' : ''}`}>
            <Text className="label">离店</Text>
            <Text className="date">{formatDisplayDate(selectedCheckOut)}</Text>
          </View>
        </View>

        <View className="calendar-nav">
          <View className="calendar-nav-btn" onClick={prevMonth}>‹</View>
          <Text className="calendar-nav-title">{currentYear}年{currentMonth + 1}月</Text>
          <View className="calendar-nav-btn" onClick={nextMonth}>›</View>
        </View>

        <View className="calendar-weekdays">
          {WEEKDAYS.map((day) => (
            <View key={day} className="calendar-weekday">{day}</View>
          ))}
        </View>

        <View className="calendar-days">
          {days.map((dayItem, index) => (
            <View
              key={`${dayItem.date}-${index}`}
              className={`calendar-day ${!dayItem.isCurrentMonth ? 'other-month' : ''} ${dayItem.isDisabled ? 'disabled' : ''} ${dayItem.isToday ? 'today' : ''} ${dayItem.isCheckIn ? 'check-in' : ''} ${dayItem.isCheckOut ? 'check-out' : ''} ${dayItem.isInRange ? 'in-range' : ''}`}
              onClick={() => handleDayClick(dayItem)}
            >
              <Text className="day-num">{dayItem.day}</Text>
              {dayItem.isCheckIn && <Text className="day-label">入住</Text>}
              {dayItem.isCheckOut && <Text className="day-label">离店</Text>}
              {dayItem.isToday && !dayItem.isCheckIn && !dayItem.isCheckOut && (
                <Text className="day-label">今天</Text>
              )}
            </View>
          ))}
        </View>

        <View className="calendar-footer">
          <View
            className={`calendar-confirm-btn ${selectedCheckIn && selectedCheckOut ? 'active' : ''}`}
            onClick={handleConfirm}
          >
            确定
          </View>
        </View>
      </View>
    </View>
  )
}

