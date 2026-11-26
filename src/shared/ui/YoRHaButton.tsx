import { useEffect, useState } from 'react'
import { TbPlaystationCircle, TbXboxA } from 'react-icons/tb'
import { gamepadManager } from '../input/GamepadManager'


export interface YoRHaButtonProps {
  onClick: () => void
  text: string
  isSelected?: boolean // 是否被选中
  disabled?: boolean // 是否禁用
  alwaysShowIcon?: boolean // 是否一直显示图标
}
export const YoRHaButton = ({ onClick = () => { }, text = 'YoRHa', isSelected = false, disabled = false, alwaysShowIcon = false }: YoRHaButtonProps) => {
  const [isHovered, setIsHovered] = useState(false) // 本地 hover 状态
  useEffect(() => {
    setIsHovered(isSelected)
  }, [isSelected])
  const controller = gamepadManager.getState().type
  const ButtonIcon = controller === 'xbox' ? TbXboxA : controller === 'dualsense' ? TbPlaystationCircle : undefined
  return (
    <div className="pointer-events-auto">
      <button
        className={`group min-w-[30em] relative overflow-hidden font-medium py-2 px-4 text-[#524E45] ${!disabled && 'hover:text-[#B3AE98]'}  transition-colors duration-300 flex items-center justify-start gap-2 ${isHovered
          ? 'bg-[#524E45] text-[#B3AE98]'
          : 'bg-[#B3AE98]'
          }`}
        onClick={onClick}
        onMouseEnter={() => {
          if (!disabled)
            setIsHovered(true)
        }} // 鼠标进入时设置 hover 状态
        onMouseLeave={() => {
          if (!disabled)
            setIsHovered(false)
        }} // 鼠标离开时取消 hover 状态
        disabled={disabled}
      >
        {/* 动画填充效果 */}
        <span
          className={`absolute inset-0 bg-[#524E45] w-0 ${!disabled && 'group-hover:w-full'} transition-all duration-150 ease-in-out ${isHovered ? 'w-full' : ''
            }`}
        ></span>

        {/* 按钮内容 */}
        <div
          className={`w-5 h-5 ${isHovered ? 'bg-[#B3AE98]' : 'bg-[#524E45]'
            } relative z-10 ${!disabled && 'group-hover:bg-[#B3AE98]'} transition-colors`}
        />
        <div className="flex items-center justify-between w-full">
          <p className="text-lg relative z-10">{text}</p>
          {ButtonIcon && (alwaysShowIcon || isHovered) && (
            <ButtonIcon size={25} className={isHovered ? 'z-10 text-[#B3AE98]' : 'z-10 text-[#524E45]'} />
          )}
        </div>
      </button>
    </div>
  )
}
