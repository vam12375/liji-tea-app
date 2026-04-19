import { useMemo, useState, type ReactNode } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { TeaImage } from "@/components/ui/TeaImage";
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/Colors';
import { track } from '@/lib/analytics';
import { uploadCommunityMedia } from '@/lib/communityMedia';
import { showModal } from '@/stores/modalStore';
import { useCommunityStore, type CreatePostInput, type Post } from '@/stores/communityStore';
import { useUserStore } from '@/stores/userStore';

type SelectedImage = Pick<ImagePicker.ImagePickerAsset, 'uri' | 'base64' | 'mimeType' | 'fileName'>;

const POST_TYPES: { key: Post['type']; label: string; hint: string }[] = [
  { key: 'photo', label: '晒图动态', hint: '分享茶席、茶山、茶具或日常喝茶瞬间' },
  { key: 'brewing', label: '冲泡记录', hint: '记录茶名、参数和一句自己的品饮感受' },
  { key: 'question', label: '发起提问', hint: '把选茶、器具、冲泡问题抛给茶友' },
];

export default function CreateCommunityPostScreen() {
  const insets = useSafeAreaInsets();
  const { type: initialType } = useLocalSearchParams<{ type?: Post['type'] }>();
  const createPost = useCommunityStore((state) => state.createPost);
  const submitting = useCommunityStore((state) => state.submitting);
  const session = useUserStore((state) => state.session);

  const defaultType = initialType && POST_TYPES.some((item) => item.key === initialType) ? initialType : 'photo';
  const [type, setType] = useState<Post['type']>(defaultType);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [teaName, setTeaName] = useState('');
  const [quote, setQuote] = useState('');
  const [temperature, setTemperature] = useState('100°C');
  const [brewTime, setBrewTime] = useState('10秒');
  const [amount, setAmount] = useState('5g/110ml');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoImage, setPhotoImage] = useState<SelectedImage | null>(null);
  const [brewingImages, setBrewingImages] = useState<SelectedImage[]>([]);
  const [uploading, setUploading] = useState(false);

  const currentTypeMeta = useMemo(
    () => POST_TYPES.find((item) => item.key === type) ?? POST_TYPES[0],
    [type]
  );

  const resetFieldsForType = (nextType: Post['type']) => {
    setType(nextType);
    setCaption('');
    setLocation('');
    setTeaName('');
    setQuote('');
    setTemperature('100°C');
    setBrewTime('10秒');
    setAmount('5g/110ml');
    setTitle('');
    setDescription('');
    setPhotoImage(null);
    setBrewingImages([]);
  };

  const ensureLoggedIn = () => {
    if (session?.user?.id) return session.user.id;

    showModal('请先登录', '发布社区内容前，请先登录账号。', 'info');
    router.push('/login');
    return null;
  };

  const requestMediaPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showModal('无法访问相册', '请先授予相册权限，再选择要上传的图片。', 'info');
      return false;
    }

    return true;
  };

  const pickPhotoImage = async () => {
    const granted = await requestMediaPermission();
    if (!granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 4],
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoImage(result.assets[0]);
    }
  };

  const pickBrewingImages = async () => {
    const granted = await requestMediaPermission();
    if (!granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 3,
      orderedSelection: true,
      base64: true,
    });

    if (!result.canceled) {
      setBrewingImages(result.assets.slice(0, 3));
    }
  };

  const handleSubmit = async () => {
    const userId = ensureLoggedIn();
    if (!userId) return;

    let payload: CreatePostInput | null = null;

    if (type === 'photo') {
      if (!caption.trim()) {
        showModal('还差一点内容', '请先写下这条动态想分享的内容。', 'info');
        return;
      }
      payload = {
        type,
        caption: caption.trim(),
        location: location.trim() || undefined,
      };
    }

    if (type === 'brewing') {
      if (!teaName.trim() || !quote.trim()) {
        showModal('冲泡记录未完成', '请至少填写茶名和一句品饮感受。', 'info');
        return;
      }
      payload = {
        type,
        teaName: teaName.trim(),
        quote: quote.trim(),
        brewingData: {
          temp: temperature.trim() || '100°C',
          time: brewTime.trim() || '10秒',
          amount: amount.trim() || '5g/110ml',
        },
      };
    }

    if (type === 'question') {
      if (!title.trim() || !description.trim()) {
        showModal('问题还没写完整', '请补充标题和问题描述。', 'info');
        return;
      }
      payload = {
        type,
        title: title.trim(),
        description: description.trim(),
      };
    }

    if (!payload) return;

    try {
      setUploading(true);

      if (type === 'photo' && photoImage?.base64) {
        payload.image = await uploadCommunityMedia({
          base64: photoImage.base64,
          userId,
          fileName: photoImage.fileName,
          mimeType: photoImage.mimeType,
        });
      }

      if (type === 'brewing' && brewingImages.length > 0) {
        payload.brewingImages = await Promise.all(
          brewingImages
            .filter((image) => image.base64)
            .map((image) =>
              uploadCommunityMedia({
                base64: image.base64 as string,
                userId,
                fileName: image.fileName,
                mimeType: image.mimeType,
              })
            )
        );
      }

      const newPost = await createPost(payload);
      track('post_publish', { postId: newPost.id, type });
      showModal('发布成功', '你的内容已经同步到社区。', 'success');
      router.replace({ pathname: "/post/[id]", params: { id: newPost.id } });
    } catch (error: any) {
      showModal('发布失败', error?.message ?? '请稍后重试。', 'error');
    } finally {
      setUploading(false);
    }
  };

  const busy = submitting || uploading;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top }} className="px-4 pb-3 bg-background border-b border-outline-variant/10">
        <View className="flex-row items-center h-12">
          <Pressable onPress={() => router.back()} className="w-10 h-10 items-center justify-center active:opacity-60">
            <MaterialIcons name="arrow-back" size={22} color={Colors.onSurface} />
          </Pressable>
          <View className="flex-1 ml-2">
            <Text className="text-on-surface text-lg font-bold">发布到社区</Text>
            <Text className="text-outline text-[11px]">{currentTypeMeta.hint}</Text>
          </View>
          <Pressable
            onPress={handleSubmit}
            disabled={busy}
            className={`px-4 py-2 rounded-full ${busy ? 'bg-primary/50' : 'bg-primary'} active:opacity-80`}
          >
            <Text className="text-white text-xs font-medium">{busy ? '发布中' : '发布'}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-4 py-5 gap-5" showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          <Text className="text-on-surface text-sm font-bold">选择内容类型</Text>
          <View className="gap-3">
            {POST_TYPES.map((item) => {
              const selected = item.key === type;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => resetFieldsForType(item.key)}
                  className={`rounded-3xl px-4 py-4 border ${selected ? 'bg-primary-container/15 border-primary/20' : 'bg-surface-container-low border-outline-variant/10'}`}
                >
                  <View className="flex-row items-center justify-between gap-3">
                    <View className="flex-1 gap-1">
                      <Text className="text-on-surface text-sm font-bold">{item.label}</Text>
                      <Text className="text-on-surface-variant text-xs leading-5">{item.hint}</Text>
                    </View>
                    <MaterialIcons
                      name={selected ? 'radio-button-checked' : 'radio-button-off'}
                      size={20}
                      color={selected ? Colors.primary : Colors.outline}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {type === 'photo' && (
          <View className="gap-4">
            <Field label="分享内容">
              <TextInput
                value={caption}
                onChangeText={setCaption}
                editable={!busy}
                placeholder="比如：今天开了一泡肉桂，花香特别干净..."
                placeholderTextColor={Colors.outline}
                multiline
                textAlignVertical="top"
                className="min-h-[120px] rounded-3xl bg-surface-container-low px-4 py-4 text-on-surface"
              />
            </Field>
            <Field label="位置（可选）">
              <TextInput
                value={location}
                onChangeText={setLocation}
                editable={!busy}
                placeholder="例如：武夷山 / 家中茶席"
                placeholderTextColor={Colors.outline}
                className="rounded-full bg-surface-container-low px-4 py-3 text-on-surface"
              />
            </Field>
            <ImagePickerField
              label="动态配图（可选）"
              hint="选择 1 张图片，发布时会上传到 Supabase Storage。"
              assets={photoImage ? [photoImage] : []}
              onPick={pickPhotoImage}
              onRemove={(index) => {
                if (index === 0) setPhotoImage(null);
              }}
              disabled={busy}
            />
          </View>
        )}

        {type === 'brewing' && (
          <View className="gap-4">
            <Field label="茶名">
              <TextInput
                value={teaName}
                onChangeText={setTeaName}
                editable={!busy}
                placeholder="例如：正岩肉桂"
                placeholderTextColor={Colors.outline}
                className="rounded-full bg-surface-container-low px-4 py-3 text-on-surface"
              />
            </Field>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field label="水温">
                  <TextInput
                    value={temperature}
                    onChangeText={setTemperature}
                    editable={!busy}
                    placeholder="100°C"
                    placeholderTextColor={Colors.outline}
                    className="rounded-full bg-surface-container-low px-4 py-3 text-on-surface"
                  />
                </Field>
              </View>
              <View className="flex-1">
                <Field label="时间">
                  <TextInput
                    value={brewTime}
                    onChangeText={setBrewTime}
                    editable={!busy}
                    placeholder="10秒"
                    placeholderTextColor={Colors.outline}
                    className="rounded-full bg-surface-container-low px-4 py-3 text-on-surface"
                  />
                </Field>
              </View>
            </View>
            <Field label="投茶量">
              <TextInput
                value={amount}
                onChangeText={setAmount}
                editable={!busy}
                placeholder="5g/110ml"
                placeholderTextColor={Colors.outline}
                className="rounded-full bg-surface-container-low px-4 py-3 text-on-surface"
              />
            </Field>
            <Field label="一句感受">
              <TextInput
                value={quote}
                onChangeText={setQuote}
                editable={!busy}
                placeholder="比如：第三泡开始花果香彻底打开了"
                placeholderTextColor={Colors.outline}
                multiline
                textAlignVertical="top"
                className="min-h-[100px] rounded-3xl bg-surface-container-low px-4 py-4 text-on-surface"
              />
            </Field>
            <ImagePickerField
              label="冲泡实拍（可选）"
              hint="最多选择 3 张图片，会按顺序上传并展示。"
              assets={brewingImages}
              onPick={pickBrewingImages}
              onRemove={(index) => setBrewingImages((current) => current.filter((_, currentIndex) => currentIndex !== index))}
              disabled={busy}
            />
          </View>
        )}

        {type === 'question' && (
          <View className="gap-4">
            <Field label="问题标题">
              <TextInput
                value={title}
                onChangeText={setTitle}
                editable={!busy}
                placeholder="例如：新手怎么分辨真假金骏眉？"
                placeholderTextColor={Colors.outline}
                className="rounded-3xl bg-surface-container-low px-4 py-4 text-on-surface"
              />
            </Field>
            <Field label="问题描述">
              <TextInput
                value={description}
                onChangeText={setDescription}
                editable={!busy}
                placeholder="把预算、口味、疑惑点都写出来，方便茶友更准确地回答你。"
                placeholderTextColor={Colors.outline}
                multiline
                textAlignVertical="top"
                className="min-h-[140px] rounded-3xl bg-surface-container-low px-4 py-4 text-on-surface"
              />
            </Field>
          </View>
        )}

        <View className="rounded-3xl bg-secondary-container/20 px-4 py-4 gap-2">
          <Text className="text-on-surface text-sm font-bold">发布说明</Text>
          <Text className="text-on-surface-variant text-xs leading-5">
            发布内容会直接写入 Supabase 数据库；如果选择图片，也会同步上传到云端社区媒体库。
          </Text>
        </View>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-on-surface text-sm font-bold">{label}</Text>
      {children}
    </View>
  );
}

function ImagePickerField({
  label,
  hint,
  assets,
  onPick,
  onRemove,
  disabled,
}: {
  label: string;
  hint: string;
  assets: SelectedImage[];
  onPick: () => void;
  onRemove: (index: number) => void;
  disabled: boolean;
}) {
  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text className="text-on-surface text-sm font-bold">{label}</Text>
        <Text className="text-on-surface-variant text-xs leading-5">{hint}</Text>
      </View>

      <Pressable
        onPress={onPick}
        disabled={disabled}
        className={`rounded-3xl border border-dashed px-4 py-4 flex-row items-center justify-center gap-2 ${disabled ? 'border-outline-variant/20 bg-surface-container-low/60' : 'border-outline-variant bg-surface-container-low'}`}
      >
        <MaterialIcons name="add-photo-alternate" size={20} color={Colors.primary} />
        <Text className="text-primary text-sm font-medium">选择图片</Text>
      </Pressable>

      {assets.length > 0 ? (
        <View className="flex-row gap-3 flex-wrap">
          {assets.map((asset, index) => (
            <View key={`${asset.uri}-${index}`} className="relative">
              <TeaImage source={{ uri: asset.uri }} style={{ width: 104, height: 104, borderRadius: 16 }} contentFit="cover" />
              <Pressable
                onPress={() => onRemove(index)}
                className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-black/70 items-center justify-center"
              >
                <MaterialIcons name="close" size={16} color="#fff" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
