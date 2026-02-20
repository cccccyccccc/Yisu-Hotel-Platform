import { View, Text, Textarea, Image } from '@tarojs/components'
import { useLoad, useRouter } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { createReview, uploadReviewImages } from '../../services'
import './index.scss'

const RATING_LABELS = ['', '很差', '较差', '一般', '满意', '非常满意']

export default function ReviewCreate() {
  const router = useRouter()
  const orderId = router.params.orderId || ''
  const hotelId = router.params.hotelId || ''

  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useLoad(() => {
    if (!orderId || !hotelId) {
      Taro.showToast({ title: '参数错误', icon: 'none' })
    }
  })

  const handleChooseImage = () => {
    const remaining = 6 - images.length
    if (remaining <= 0) {
      Taro.showToast({ title: '最多上传6张图片', icon: 'none' })
      return
    }
    Taro.chooseImage({
      count: remaining,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        setImages(prev => [...prev, ...res.tempFilePaths])
      },
    })
  }

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!content.trim()) {
      Taro.showToast({ title: '请填写评价内容', icon: 'none' })
      return
    }
    if (content.trim().length < 10) {
      Taro.showToast({ title: '评价内容至少10个字', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      // 先上传图片
      let imageUrls: string[] = []
      if (images.length > 0) {
        Taro.showLoading({ title: '上传图片中...' })
        imageUrls = await uploadReviewImages(images)
        Taro.hideLoading()
      }

      await createReview({
        hotelId,
        orderId,
        rating,
        content: content.trim(),
        images: imageUrls,
      })
      Taro.showToast({ title: '评价成功', icon: 'success' })
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      Taro.hideLoading()
      console.error('评价失败:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="review-create-page">
      {/* 评分 */}
      <View className="rating-section">
        <Text className="section-title">整体评分</Text>
        <View className="star-row">
          {[1, 2, 3, 4, 5].map(star => (
            <Text
              key={star}
              className={`star ${star <= rating ? 'active' : ''}`}
              onClick={() => setRating(star)}
            >
              {star <= rating ? '★' : '☆'}
            </Text>
          ))}
        </View>
        <Text className="rating-label">{RATING_LABELS[rating]}</Text>
      </View>

      {/* 评价内容 */}
      <View className="content-section">
        <Text className="section-title">评价内容</Text>
        <Textarea
          className="content-input"
          placeholder="分享您的入住体验，帮助其他旅客做出选择（至少10个字）"
          value={content}
          onInput={(e) => setContent(e.detail.value)}
          maxlength={500}
        />
        <Text className="char-count">{content.length}/500</Text>
      </View>

      {/* 图片上传 */}
      <View className="image-section">
        <Text className="section-title">上传图片（最多6张）</Text>
        <View className="image-grid">
          {images.map((img, idx) => (
            <View key={idx} className="image-item">
              <Image src={img} className="preview-img" mode="aspectFill" />
              <View className="remove-btn" onClick={() => handleRemoveImage(idx)}>
                <Text>×</Text>
              </View>
            </View>
          ))}
          {images.length < 6 && (
            <View className="add-image" onClick={handleChooseImage}>
              <Text className="add-icon">+</Text>
              <Text className="add-text">添加图片</Text>
            </View>
          )}
        </View>
      </View>

      {/* 提交按钮 */}
      <View
        className={`submit-btn ${loading ? 'disabled' : ''}`}
        onClick={!loading ? handleSubmit : undefined}
      >
        <Text>{loading ? '提交中...' : '提交评价'}</Text>
      </View>
    </View>
  )
}
