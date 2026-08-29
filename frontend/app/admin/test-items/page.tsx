'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';

type UserRole = 'USER' | 'LEADER' | 'ADMIN';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  default_ios: boolean;
  default_android: boolean;
  default_new: boolean;
  default_resubmission: boolean;
  default_development_review: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  item_count: number;
}

interface TestItem {
  id: string;
  tc_no: string;
  tc_code: string;
  category_id: string;
  category_name: string;
  title: string;
  check_content: string;
  test_method: string;
  reference_note: string;
  sort_order: number;
  is_active: boolean;
  applies_ios: boolean;
  applies_android: boolean;
  applies_new: boolean;
  applies_resubmission: boolean;
  applies_development_review: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

interface TestItemAttachment {
  id: string;
  test_item_id: string;
  original_name: string;
  mime_type: string;
  file_size: string | number;
  created_by: string;
  created_at: string;
}

type Selection =
  | {
      type: 'category';
      id: string;
    }
  | {
      type: 'item';
      id: string;
    };

type CreateType = 'category' | 'item';

interface CreateCategoryDraft {
  name: string;
  description: string;
  sortOrder: number;
  defaultIos: boolean;
  defaultAndroid: boolean;
  defaultNew: boolean;
  defaultResubmission: boolean;
  defaultDevelopmentReview: boolean;
}

interface CreateItemDraft {
  categoryId: string;
  title: string;
  checkContent: string;
  testMethod: string;
  operationSteps: string;
  referenceNote: string;
  sortOrder: number;
  appliesIos: boolean;
  appliesAndroid: boolean;
  appliesNew: boolean;
  appliesResubmission: boolean;
  appliesDevelopmentReview: boolean;
}

const OPERATION_STEPS_MARKER = '\n\n[조작 순서]\n';

function splitTestMethod(value: string) {
  const markerIndex = value.indexOf(OPERATION_STEPS_MARKER);

  if (markerIndex < 0) {
    return {
      description: value,
      operationSteps: '',
    };
  }

  return {
    description: value.slice(0, markerIndex),
    operationSteps: value.slice(
      markerIndex + OPERATION_STEPS_MARKER.length,
    ),
  };
}

function combineTestMethod(
  description: string,
  operationSteps: string,
) {
  const cleanDescription = description.trim();
  const cleanOperationSteps = operationSteps.trim();

  if (!cleanOperationSteps) {
    return cleanDescription;
  }

  return `${cleanDescription}${OPERATION_STEPS_MARKER}${cleanOperationSteps}`;
}

function formatDate(value: string) {
  if (!value) return '-';

  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TestItemManagementPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [testItems, setTestItems] = useState<TestItem[]>([]);

  const [selection, setSelection] =
    useState<Selection | null>(null);

  const [categoryDraft, setCategoryDraft] =
    useState<Category | null>(null);

  const [itemDraft, setItemDraft] =
    useState<TestItem | null>(null);

  const [collapsedCategories, setCollapsedCategories] =
    useState<Set<string>>(new Set());

  const [searchText, setSearchText] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] =
    useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState('');
  const [successMessage, setSuccessMessage] =
    useState('');
  const [createErrorMessage, setCreateErrorMessage] =
    useState('');

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [createType, setCreateType] =
    useState<CreateType>('category');

  const [createCategoryDraft, setCreateCategoryDraft] =
    useState<CreateCategoryDraft>({
      name: '',
      description: '',
      sortOrder: 0,
      defaultIos: true,
      defaultAndroid: true,
      defaultNew: true,
      defaultResubmission: true,
      defaultDevelopmentReview: false,
    });

  const [pendingAttachmentChanges, setPendingAttachmentChanges] =
    useState<{
      itemId: string;
      newFiles: File[];
      deletedIds: string[];
    } | null>(null);

  const [attachmentResetVersion, setAttachmentResetVersion] =
    useState(0);

  const [createAttachmentFiles, setCreateAttachmentFiles] =
    useState<File[]>([]);

  const [createItemDraft, setCreateItemDraft] =
    useState<CreateItemDraft>({
      categoryId: '',
      title: '',
      checkContent: '',
      testMethod: '',
      operationSteps: '',
      referenceNote: '',
      sortOrder: 0,
      appliesIos: true,
      appliesAndroid: true,
      appliesNew: true,
      appliesResubmission: true,
      appliesDevelopmentReview: false,
    });

  const getToken = useCallback(() => {
    return localStorage.getItem('qa_checker_token');
  }, []);

  const loadData = useCallback(
    async (refresh = false) => {
      const token = getToken();
      const storedUser =
        localStorage.getItem('qa_checker_user');

      if (!token || !storedUser) {
        router.replace('/');
        return;
      }

      let parsedUser: User;

      try {
        parsedUser = JSON.parse(storedUser);
      } catch {
        localStorage.removeItem('qa_checker_token');
        localStorage.removeItem('qa_checker_user');
        router.replace('/');
        return;
      }

      if (parsedUser.role !== 'ADMIN') {
        window.alert('관리자만 접근할 수 있습니다.');
        router.replace('/dashboard');
        return;
      }

      setUser(parsedUser);

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage('');

      try {
        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [categoryResponse, itemResponse] =
          await Promise.all([
            fetch(
              'http://127.0.0.1:3001/categories?includeInactive=true',
              {
                headers,
                cache: 'no-store',
              },
            ),
            fetch(
              'http://127.0.0.1:3001/test-items?includeInactive=true',
              {
                headers,
                cache: 'no-store',
              },
            ),
          ]);

        if (
          categoryResponse.status === 401 ||
          itemResponse.status === 401
        ) {
          localStorage.removeItem(
            'qa_checker_token',
          );
          localStorage.removeItem(
            'qa_checker_user',
          );
          router.replace('/');
          return;
        }

        const categoryData =
          await categoryResponse.json();
        const itemData =
          await itemResponse.json();

        if (!categoryResponse.ok) {
          throw new Error(
            categoryData?.message ??
              '카테고리를 불러오지 못했습니다.',
          );
        }

        if (!itemResponse.ok) {
          throw new Error(
            itemData?.message ??
              '테스트 항목을 불러오지 못했습니다.',
          );
        }

        const sortedCategories: Category[] =
          [...categoryData].sort(
            (a, b) =>
              a.sort_order - b.sort_order ||
              a.name.localeCompare(
                b.name,
                'ko-KR',
              ),
          );

        const sortedItems: TestItem[] =
          [...itemData].sort(
            (a, b) =>
              a.sort_order - b.sort_order ||
              Number(a.tc_no) - Number(b.tc_no) ||
              a.title.localeCompare(
                b.title,
                'ko-KR',
              ),
          );

        setCategories(sortedCategories);
        setTestItems(sortedItems);

        if (!selection && sortedCategories.length > 0) {
          const firstCategory =
            sortedCategories[0];

          setSelection({
            type: 'category',
            id: firstCategory.id,
          });

          setCategoryDraft({
            ...firstCategory,
          });

          setItemDraft(null);
        } else if (selection?.type === 'category') {
          const updatedCategory =
            sortedCategories.find(
              (category) =>
                category.id === selection.id,
            );

          if (updatedCategory) {
            setCategoryDraft({
              ...updatedCategory,
            });
          }
        } else if (selection?.type === 'item') {
          const updatedItem =
            sortedItems.find(
              (item) => item.id === selection.id,
            );

          if (updatedItem) {
            setItemDraft({
              ...updatedItem,
            });
          }
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : '데이터를 불러오는 중 오류가 발생했습니다.',
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [getToken, router, selection],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedCategory = useMemo(() => {
    if (
      !selection ||
      selection.type !== 'category'
    ) {
      return null;
    }

    return (
      categories.find(
        (category) =>
          category.id === selection.id,
      ) ?? null
    );
  }, [categories, selection]);

  const selectedItem = useMemo(() => {
    if (
      !selection ||
      selection.type !== 'item'
    ) {
      return null;
    }

    return (
      testItems.find(
        (item) => item.id === selection.id,
      ) ?? null
    );
  }, [testItems, selection]);

  const hasChanges = useMemo(() => {
    if (
      selection?.type === 'category' &&
      selectedCategory &&
      categoryDraft
    ) {
      return (
        JSON.stringify(selectedCategory) !==
        JSON.stringify(categoryDraft)
      );
    }

    if (
      selection?.type === 'item' &&
      selectedItem &&
      itemDraft
    ) {
      return (
        JSON.stringify(selectedItem) !==
          JSON.stringify(itemDraft) ||
        pendingAttachmentChanges?.itemId === itemDraft.id
      );
    }

    return false;
  }, [
    selection,
    selectedCategory,
    categoryDraft,
    selectedItem,
    itemDraft,
    pendingAttachmentChanges,
  ]);

  const filteredCategoryIds = useMemo(() => {
    const keyword =
      searchText.trim().toLocaleLowerCase();

    if (!keyword) {
      return new Set(
        categories.map(
          (category) => category.id,
        ),
      );
    }

    const matches = new Set<string>();

    categories.forEach((category) => {
      if (
        category.name
          .toLocaleLowerCase()
          .includes(keyword)
      ) {
        matches.add(category.id);
      }
    });

    testItems.forEach((item) => {
      const tcNumber = item.tc_no ?? '';
      const tcCode =
        item.tc_code?.toLocaleLowerCase() ?? '';
      const title =
        item.title.toLocaleLowerCase();

      if (
        tcNumber.includes(keyword) ||
        tcCode.includes(keyword) ||
        title.includes(keyword)
      ) {
        matches.add(item.category_id);
      }
    });

    return matches;
  }, [categories, testItems, searchText]);

  function getFilteredItems(categoryId: string) {
    const keyword =
      searchText.trim().toLocaleLowerCase();

    const items = testItems.filter(
      (item) =>
        item.category_id === categoryId,
    );

    if (!keyword) {
      return items;
    }

    const category = categories.find(
      (current) =>
        current.id === categoryId,
    );

    const categoryMatches =
      category?.name
        .toLocaleLowerCase()
        .includes(keyword) ?? false;

    if (categoryMatches) {
      return items;
    }

    return items.filter((item) => {
      return (
        item.tc_no.includes(keyword) ||
        item.tc_code
          .toLocaleLowerCase()
          .includes(keyword) ||
        item.title
          .toLocaleLowerCase()
          .includes(keyword)
      );
    });
  }

  function selectCategory(category: Category) {
    if (hasChanges) {
      const confirmed = window.confirm(
        '저장하지 않은 변경사항이 있습니다.\n변경 내용을 취소하고 이동할까요?',
      );

      if (!confirmed) return;

      setPendingAttachmentChanges(null);
      setAttachmentResetVersion(
        (current) => current + 1,
      );
    }

    setSelection({
      type: 'category',
      id: category.id,
    });

    setCategoryDraft({
      ...category,
    });

    setItemDraft(null);
    setSuccessMessage('');
  }

  function selectItem(item: TestItem) {
    if (hasChanges) {
      const confirmed = window.confirm(
        '저장하지 않은 변경사항이 있습니다.\n변경 내용을 취소하고 이동할까요?',
      );

      if (!confirmed) return;

      setPendingAttachmentChanges(null);
      setAttachmentResetVersion(
        (current) => current + 1,
      );
    }

    setSelection({
      type: 'item',
      id: item.id,
    });

    setItemDraft({
      ...item,
    });

    setCategoryDraft(null);
    setSuccessMessage('');
  }

  function cancelChanges() {
    if (
      selection?.type === 'category' &&
      selectedCategory
    ) {
      setCategoryDraft({
        ...selectedCategory,
      });
      return;
    }

    if (
      selection?.type === 'item' &&
      selectedItem
    ) {
      setItemDraft({
        ...selectedItem,
      });
      setPendingAttachmentChanges(null);
      setAttachmentResetVersion(
        (current) => current + 1,
      );
    }
  }

  async function saveChanges() {
    if (!selection || !hasChanges) return;

    const token = getToken();

    if (!token) {
      router.replace('/');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (
        selection.type === 'category' &&
        categoryDraft &&
        selectedCategory
      ) {
        const updateResponse = await fetch(
          `http://127.0.0.1:3001/categories/${categoryDraft.id}`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: categoryDraft.name,
              description:
                categoryDraft.description ?? '',
              sortOrder:
                categoryDraft.sort_order,
              defaultIos:
                categoryDraft.default_ios,
              defaultAndroid:
                categoryDraft.default_android,
              defaultNew:
                categoryDraft.default_new,
              defaultResubmission:
                categoryDraft.default_resubmission,
              defaultDevelopmentReview:
                categoryDraft.default_development_review,
            }),
          },
        );

        const updateData =
          await updateResponse.json();

        if (!updateResponse.ok) {
          throw new Error(
            updateData?.message ??
              '카테고리 수정에 실패했습니다.',
          );
        }

        if (
          categoryDraft.is_active !==
          selectedCategory.is_active
        ) {
          const activeResponse = await fetch(
            `http://127.0.0.1:3001/categories/${categoryDraft.id}/${
              categoryDraft.is_active
                ? 'activate'
                : 'deactivate'
            }`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );

          const activeData =
            await activeResponse.json();

          if (!activeResponse.ok) {
            throw new Error(
              activeData?.message ??
                '카테고리 상태 변경에 실패했습니다.',
            );
          }
        }

        setSuccessMessage(
          '카테고리가 저장되었습니다.',
        );
      }

      if (
        selection.type === 'item' &&
        itemDraft &&
        selectedItem
      ) {
        const updateResponse = await fetch(
          `http://127.0.0.1:3001/test-items/${itemDraft.id}`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              categoryId:
                itemDraft.category_id,
              title: itemDraft.title,
              checkContent:
                itemDraft.check_content,
              testMethod:
                itemDraft.test_method,
              referenceNote: '',
              sortOrder:
                itemDraft.sort_order,
              appliesIos:
                itemDraft.applies_ios,
              appliesAndroid:
                itemDraft.applies_android,
              appliesNew:
                itemDraft.applies_new,
              appliesResubmission:
                itemDraft.applies_resubmission,
              appliesDevelopmentReview:
                itemDraft.applies_development_review,
            }),
          },
        );

        const updateData =
          await updateResponse.json();

        if (!updateResponse.ok) {
          throw new Error(
            updateData?.message ??
              'TC 수정에 실패했습니다.',
          );
        }

        if (
          itemDraft.is_active !==
          selectedItem.is_active
        ) {
          const activeResponse = await fetch(
            `http://127.0.0.1:3001/test-items/${itemDraft.id}/${
              itemDraft.is_active
                ? 'activate'
                : 'deactivate'
            }`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );

          const activeData =
            await activeResponse.json();

          if (!activeResponse.ok) {
            throw new Error(
              activeData?.message ??
                'TC 상태 변경에 실패했습니다.',
            );
          }
        }

        if (
          pendingAttachmentChanges?.itemId ===
          itemDraft.id
        ) {
          for (
            const attachmentId of
            pendingAttachmentChanges.deletedIds
          ) {
            const deleteResponse = await fetch(
              `http://127.0.0.1:3001/test-items/${itemDraft.id}/attachments/${attachmentId}`,
              {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              },
            );

            if (!deleteResponse.ok) {
              const deleteData =
                await deleteResponse.json();

              throw new Error(
                deleteData?.message ??
                  '참고 자료 삭제에 실패했습니다.',
              );
            }
          }

          for (
            const file of
            pendingAttachmentChanges.newFiles
          ) {
            const formData = new FormData();
            formData.append('file', file);

            const uploadResponse = await fetch(
              `http://127.0.0.1:3001/test-items/${itemDraft.id}/attachments`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
                body: formData,
              },
            );

            if (!uploadResponse.ok) {
              const uploadData =
                await uploadResponse.json();

              throw new Error(
                uploadData?.message ??
                  `${file.name} 업로드에 실패했습니다.`,
              );
            }
          }
        }

        setPendingAttachmentChanges(null);
        setAttachmentResetVersion(
          (current) => current + 1,
        );

        setSuccessMessage(
          `${itemDraft.tc_code}가 저장되었습니다.`,
        );
      }

      await loadData(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : '저장 중 오류가 발생했습니다.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function openCreateModal() {
    setCreateErrorMessage('');
    setCreateAttachmentFiles([]);

    const firstCategory =
      categories.find(
        (category) => category.is_active,
      ) ?? categories[0];

    setCreateType('category');

    setCreateCategoryDraft({
      name: '',
      description: '',
      sortOrder:
        categories.length > 0
          ? Math.max(
              ...categories.map(
                (category) =>
                  category.sort_order,
              ),
            ) + 1
          : 1,
      defaultIos: true,
      defaultAndroid: true,
      defaultNew: true,
      defaultResubmission: true,
      defaultDevelopmentReview: false,
    });

    const firstCategoryItems = firstCategory
      ? testItems.filter(
          (item) =>
            item.category_id === firstCategory.id,
        )
      : [];

    const firstCategoryNextSortOrder =
      firstCategoryItems.length > 0
        ? Math.max(
            ...firstCategoryItems.map(
              (item) => item.sort_order,
            ),
          ) + 1
        : 1;

    setCreateItemDraft({
      categoryId:
        firstCategory?.id ?? '',
      title: '',
      checkContent: '',
      testMethod: '',
      operationSteps: '',
      referenceNote: '',
      sortOrder: firstCategoryNextSortOrder,
      appliesIos:
        firstCategory?.default_ios ??
        true,
      appliesAndroid:
        firstCategory?.default_android ??
        true,
      appliesNew:
        firstCategory?.default_new ??
        true,
      appliesResubmission:
        firstCategory?.default_resubmission ??
        true,
      appliesDevelopmentReview:
        firstCategory?.default_development_review ??
        false,
    });

    setShowCreateModal(true);
  }

  function changeCreateType(
    type: CreateType,
  ) {
    setCreateErrorMessage('');
    setCreateType(type);

    if (type === 'item') {
      const category =
        categories.find(
          (current) =>
            current.id ===
            createItemDraft.categoryId,
        ) ??
        categories.find(
          (current) => current.is_active,
        ) ??
        categories[0];

      if (category) {
        setCreateItemDraft(
          (current) => ({
            ...current,
            categoryId: category.id,
            appliesIos:
              category.default_ios,
            appliesAndroid:
              category.default_android,
            appliesNew:
              category.default_new,
            appliesResubmission:
              category.default_resubmission,
            appliesDevelopmentReview:
              category.default_development_review,
          }),
        );
      }
    }
  }

  function changeCreateCategory(
    categoryId: string,
  ) {
    const category = categories.find(
      (current) =>
        current.id === categoryId,
    );

    if (!category) return;

    const categoryItems =
      testItems.filter(
        (item) =>
          item.category_id === categoryId,
      );

    const nextSortOrder =
      categoryItems.length > 0
        ? Math.max(
            ...categoryItems.map(
              (item) =>
                item.sort_order,
            ),
          ) + 1
        : 1;

    setCreateItemDraft(
      (current) => ({
        ...current,
        categoryId,
        sortOrder: nextSortOrder,
        appliesIos:
          category.default_ios,
        appliesAndroid:
          category.default_android,
        appliesNew:
          category.default_new,
        appliesResubmission:
          category.default_resubmission,
        appliesDevelopmentReview:
          category.default_development_review,
      }),
    );
  }

  async function createNewEntry() {
    const token = getToken();

    if (!token) {
      router.replace('/');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    setCreateErrorMessage('');

    try {
      if (createType === 'category') {
        const missingCategoryFields: string[] = [];

        if (!createCategoryDraft.name.trim()) {
          missingCategoryFields.push('카테고리명');
        }

        if (!createCategoryDraft.description.trim()) {
          missingCategoryFields.push('설명');
        }

        if (missingCategoryFields.length > 0) {
          throw new Error(
            `필수 항목을 입력해주세요: ${missingCategoryFields.join(', ')}`,
          );
        }

        const response = await fetch(
          'http://127.0.0.1:3001/categories',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              name:
                createCategoryDraft.name,
              description:
                createCategoryDraft.description,
              sortOrder:
                createCategoryDraft.sortOrder,
              defaultIos:
                createCategoryDraft.defaultIos,
              defaultAndroid:
                createCategoryDraft.defaultAndroid,
              defaultNew:
                createCategoryDraft.defaultNew,
              defaultResubmission:
                createCategoryDraft.defaultResubmission,
              defaultDevelopmentReview:
                createCategoryDraft.defaultDevelopmentReview,
            }),
          },
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message ??
              '카테고리 생성에 실패했습니다.',
          );
        }

        setShowCreateModal(false);

        await loadData(true);

        setSelection({
          type: 'category',
          id: data.id,
        });

        setCategoryDraft({
          ...data,
          item_count: 0,
        });

        setItemDraft(null);

        setSuccessMessage(
          '새 카테고리가 생성되었습니다.',
        );
      }

      if (createType === 'item') {
        const missingFields: string[] = [];

        if (!createItemDraft.categoryId) {
          missingFields.push('카테고리');
        }

        if (!createItemDraft.title.trim()) {
          missingFields.push('TC명');
        }

        if (!createItemDraft.checkContent.trim()) {
          missingFields.push('체크 내용');
        }

        if (!createItemDraft.testMethod.trim()) {
          missingFields.push('테스트 방법');
        }

        if (missingFields.length > 0) {
          throw new Error(
            `필수 항목을 입력해주세요: ${missingFields.join(', ')}`,
          );
        }

        const response = await fetch(
          'http://127.0.0.1:3001/test-items',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              categoryId:
                createItemDraft.categoryId,
              title:
                createItemDraft.title,
              checkContent:
                createItemDraft.checkContent,
              testMethod: combineTestMethod(
                createItemDraft.testMethod,
                createItemDraft.operationSteps,
              ),
              referenceNote: '',
              sortOrder:
                createItemDraft.sortOrder,
              appliesIos:
                createItemDraft.appliesIos,
              appliesAndroid:
                createItemDraft.appliesAndroid,
              appliesNew:
                createItemDraft.appliesNew,
              appliesResubmission:
                createItemDraft.appliesResubmission,
              appliesDevelopmentReview:
                createItemDraft.appliesDevelopmentReview,
            }),
          },
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message ??
              'TC 생성에 실패했습니다.',
          );
        }

        for (const file of createAttachmentFiles) {
          const formData = new FormData();
          formData.append('file', file);

          const attachmentResponse = await fetch(
            `http://127.0.0.1:3001/test-items/${data.id}/attachments`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: formData,
            },
          );

          if (!attachmentResponse.ok) {
            const attachmentData =
              await attachmentResponse.json();

            throw new Error(
              attachmentData?.message ??
                `${file.name} 업로드에 실패했습니다.`,
            );
          }
        }

        setCreateAttachmentFiles([]);
        setShowCreateModal(false);

        await loadData(true);

        const category =
          categories.find(
            (current) =>
              current.id ===
              data.category_id,
          );

        setSelection({
          type: 'item',
          id: data.id,
        });

        setItemDraft({
          ...data,
          category_name:
            category?.name ?? '',
        });

        setCategoryDraft(null);

        setSuccessMessage(
          `${data.tc_code}가 생성되었습니다.`,
        );
      }
    } catch (error) {
      setCreateErrorMessage(
        error instanceof Error
          ? error.message
          : '생성 중 오류가 발생했습니다.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function toggleCategory(
    categoryId: string,
  ) {
    setCollapsedCategories(
      (current) => {
        const next =
          new Set(current);

        if (next.has(categoryId)) {
          next.delete(categoryId);
        } else {
          next.add(categoryId);
        }

        return next;
      },
    );
  }

  async function handleLogout() {
    const token = getToken();

    try {
      if (token) {
        await fetch(
          'http://127.0.0.1:3001/auth/logout',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
      }
    } catch {
      // 로컬 로그인 정보는 항상 정리합니다.
    } finally {
      localStorage.removeItem(
        'qa_checker_token',
      );
      localStorage.removeItem(
        'qa_checker_user',
      );
      router.replace('/');
    }
  }

  if (isLoading) {
    return (
      <main className="management-loading">
        테스트 항목을 불러오는 중...
        <style jsx>{styles}</style>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <button
          type="button"
          className="sidebar-brand brand-home-button"
          onClick={() =>
            router.push('/dashboard')
          }
        >
          <div className="brand-mark">
            Q
          </div>

          <div>
            <strong>QA Checker</strong>
            <span>
              Quality Assurance
            </span>
          </div>
        </button>

        <div className="account-area">
          <div className="sidebar-user">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
            <small>{user.role}</small>
          </div>
        </div>

        <nav className="sidebar-menu menu-area">
          <button
            type="button"
            className="sidebar-menu-item"
            onClick={() =>
              router.push('/projects')
            }
          >
            <span className="sidebar-menu-icon">
              ▣
            </span>
            <span>프로젝트</span>
          </button>

          <button
            type="button"
            className="sidebar-menu-item"
            onClick={() =>
              window.alert(
                '최근 작업 화면은 다음 단계에서 구현합니다.',
              )
            }
          >
            <span className="sidebar-menu-icon">
              ◷
            </span>
            <span>최근 작업</span>
          </button>

          <button
            type="button"
            className="sidebar-menu-item"
            onClick={() =>
              router.push('/tools')
            }
          >
            <span className="sidebar-menu-icon">
              ⌘
            </span>
            <span>QA 도구</span>
          </button>

          <div className="sidebar-menu-divider" />

          <button
            type="button"
            className="sidebar-menu-item active"
          >
            <span className="sidebar-menu-icon">
              ☷
            </span>
            <span>테스트 항목 관리</span>
          </button>

          <button
            type="button"
            className="sidebar-menu-item"
            onClick={() =>
              window.alert(
                '계정 관리 화면은 다음 단계에서 구현합니다.',
              )
            }
          >
            <span className="sidebar-menu-icon">
              ♙
            </span>
            <span>계정 관리</span>
          </button>
        </nav>

        <div className="sidebar-account">
          <button
            type="button"
            className="sidebar-logout-button"
            onClick={handleLogout}
          >
            로그아웃
          </button>
        </div>
      </aside>

      <section className="management-main">
        <header className="page-header">
          <div>
            <span className="page-eyebrow">
              TEST CASE MANAGEMENT
            </span>

            <h1>테스트 항목 관리</h1>

            <p>
              카테고리와 테스트 항목의
              기준, 적용 범위 및 활성
              상태를 관리합니다.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="cancel-button"
              disabled={
                !hasChanges ||
                isSaving
              }
              onClick={cancelChanges}
            >
              변경 취소
            </button>

            <button
              type="button"
              className="save-button"
              disabled={
                !hasChanges ||
                isSaving
              }
              onClick={saveChanges}
            >
              {isSaving
                ? '저장 중...'
                : '저장'}
            </button>
          </div>
        </header>

        {errorMessage && (
          <div className="message error">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="message success">
            {successMessage}
          </div>
        )}

        <section className="management-layout">
          <aside className="tree-panel">
            <div className="tree-heading">
              <div>
                <span>QA STRUCTURE</span>
                <h2>카테고리 / TC</h2>
              </div>

              <button
                type="button"
                className={
                  isRefreshing
                    ? 'refresh-button spinning'
                    : 'refresh-button'
                }
                onClick={() =>
                  loadData(true)
                }
                disabled={
                  isRefreshing ||
                  hasChanges
                }
                title="최신 상태 불러오기"
              >
                ↻
              </button>
            </div>

            <div className="tree-tools">
              <button
                type="button"
                className="create-button"
                onClick={openCreateModal}
              >
                + 신규 생성
              </button>

              <div className="search-box">
                <span>⌕</span>

                <input
                  value={searchText}
                  onChange={(event) =>
                    setSearchText(
                      event.target.value,
                    )
                  }
                  placeholder="TC 번호 / 항목명 / 카테고리 검색"
                />

                {searchText && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearchText('')
                    }
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div className="tree-list">
              {categories
                .filter((category) =>
                  filteredCategoryIds.has(
                    category.id,
                  ),
                )
                .map((category) => {
                  const categoryItems =
                    getFilteredItems(
                      category.id,
                    );

                  const collapsed =
                    collapsedCategories.has(
                      category.id,
                    );

                  const categorySelected =
                    selection?.type ===
                      'category' &&
                    selection.id ===
                      category.id;

                  return (
                    <div
                      key={category.id}
                      className="tree-category"
                    >
                      <div
                        className={
                          categorySelected
                            ? 'category-row selected'
                            : category.is_active
                              ? 'category-row'
                              : 'category-row inactive'
                        }
                      >
                        <button
                          type="button"
                          className="collapse-button"
                          onClick={() =>
                            toggleCategory(
                              category.id,
                            )
                          }
                        >
                          {collapsed
                            ? '›'
                            : '⌄'}
                        </button>

                        <button
                          type="button"
                          className="category-select"
                          onClick={() =>
                            selectCategory(
                              category,
                            )
                          }
                        >
                          <span
                            className={
                              category.is_active
                                ? 'active-dot'
                                : 'inactive-dot'
                            }
                          />

                          <strong>
                            {category.name}
                          </strong>
                        </button>

                        <span className="count-badge">
                          {
                            testItems.filter(
                              (item) =>
                                item.category_id ===
                                category.id,
                            ).length
                          }
                        </span>
                      </div>

                      {!collapsed && (
                        <div className="tree-items">
                          {categoryItems.map(
                            (item) => {
                              const itemSelected =
                                selection?.type ===
                                  'item' &&
                                selection.id ===
                                  item.id;

                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  className={
                                    itemSelected
                                      ? 'item-row selected'
                                      : item.is_active
                                        ? 'item-row'
                                        : 'item-row inactive'
                                  }
                                  onClick={() =>
                                    selectItem(
                                      item,
                                    )
                                  }
                                >
                                  <span
                                    className={
                                      item.is_active
                                        ? 'active-dot small'
                                        : 'inactive-dot small'
                                    }
                                  />

                                  <span className="tc-code">
                                    {
                                      item.tc_code
                                    }
                                  </span>

                                  <span className="tc-title">
                                    {item.title}
                                  </span>
                                </button>
                              );
                            },
                          )}

                          {categoryItems.length ===
                            0 && (
                            <div className="empty-items">
                              검색 결과가
                              없습니다.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

              {filteredCategoryIds.size ===
                0 && (
                <div className="empty-tree">
                  검색 결과가 없습니다.
                </div>
              )}
            </div>

            <div className="tree-footer">
              <span>
                <i className="active-dot" />
                활성
              </span>

              <span>
                <i className="inactive-dot" />
                비활성
              </span>

              <strong>
                카테고리{' '}
                {categories.length}개 · TC{' '}
                {testItems.length}개
              </strong>
            </div>
          </aside>

          <section className="editor-panel">
            {selection?.type ===
              'category' &&
              categoryDraft && (
                <CategoryEditor
                  draft={
                    categoryDraft
                  }
                  setDraft={
                    setCategoryDraft
                  }
                />
              )}

            {selection?.type ===
              'item' &&
              itemDraft && (
                <TestItemEditor
                  draft={itemDraft}
                  setDraft={
                    setItemDraft
                  }
                  categories={
                    categories
                  }
                  pendingChanges={
                    pendingAttachmentChanges?.itemId ===
                    itemDraft.id
                      ? pendingAttachmentChanges
                      : null
                  }
                  resetVersion={
                    attachmentResetVersion
                  }
                  onAttachmentsChanged={(
                    changes,
                  ) =>
                    setPendingAttachmentChanges({
                      itemId: itemDraft.id,
                      ...changes,
                    })
                  }
                />
              )}

            {!selection && (
              <div className="empty-editor">
                <strong>
                  관리할 항목을
                  선택하세요.
                </strong>

                <p>
                  왼쪽 목록에서 카테고리
                  또는 TC를 선택하면 상세
                  정보가 표시됩니다.
                </p>
              </div>
            )}
          </section>
        </section>

        <section className="management-guide">
          <strong>안내 사항</strong>

          <p>
            카테고리의 기본 적용값은 새
            테스트 항목을 생성할 때의
            기본값으로 사용됩니다.
          </p>

          <p>
            기존 TC의 적용 범위는
            카테고리 설정이 변경되어도
            자동으로 변경되지 않습니다.
          </p>

          <p>
            새 카테고리와 TC는 각 목록의
            맨 마지막에 자동 추가되며,
            TC 번호는 비활성화 이후에도 유지됩니다.
          </p>

          <p>
            테스트 방법에는 검증 의도와 조건을 작성하고,
            조작 순서에는 실제 수행 흐름을 &gt; 형태로 작성합니다.
          </p>
        </section>
      </section>

      {showCreateModal && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowCreateModal(
                false,
              );
            }
          }}
        >
          <section className="create-modal">
            <div className="modal-heading">
              <div>
                <span>
                  NEW QA ITEM
                </span>
                <h2>신규 생성</h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowCreateModal(
                    false,
                  )
                }
              >
                ×
              </button>
            </div>

            <div className="create-type">
              <button
                type="button"
                className={
                  createType ===
                  'category'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  changeCreateType(
                    'category',
                  )
                }
              >
                카테고리
              </button>

              <button
                type="button"
                className={
                  createType === 'item'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  changeCreateType(
                    'item',
                  )
                }
              >
                TC
              </button>
            </div>

            <div className="modal-body">
              {createErrorMessage && (
                <div className="modal-error-message">
                  <strong>입력 내용을 확인해주세요.</strong>
                  <span>{createErrorMessage}</span>
                </div>
              )}

              {createType ===
                'category' && (
                <CreateCategoryForm
                  draft={
                    createCategoryDraft
                  }
                  setDraft={
                    setCreateCategoryDraft
                  }
                />
              )}

              {createType === 'item' && (
                <CreateItemForm
                  draft={
                    createItemDraft
                  }
                  setDraft={
                    setCreateItemDraft
                  }
                  categories={
                    categories
                  }
                  onCategoryChange={
                    changeCreateCategory
                  }
                  attachmentFiles={
                    createAttachmentFiles
                  }
                  setAttachmentFiles={
                    setCreateAttachmentFiles
                  }
                />
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="modal-cancel"
                onClick={() =>
                  setShowCreateModal(
                    false,
                  )
                }
                disabled={isSaving}
              >
                취소
              </button>

              <button
                type="button"
                className="modal-create"
                onClick={createNewEntry}
                disabled={isSaving}
              >
                {isSaving
                  ? '생성 중...'
                  : '생성'}
              </button>
            </div>
          </section>
        </div>
      )}

      <style jsx>{styles}</style>
    </main>
  );
}

function CategoryEditor({
  draft,
  setDraft,
}: {
  draft: Category;
  setDraft: React.Dispatch<
    React.SetStateAction<Category | null>
  >;
}) {
  return (
    <>
      <div className="editor-heading">
        <div>
          <span className="editor-type">
            CATEGORY
          </span>

          <div className="editor-title-row">
            <h2>{draft.name}</h2>

            <span
              className={
                draft.is_active
                  ? 'state-badge active'
                  : 'state-badge inactive'
              }
            >
              {draft.is_active
                ? '활성'
                : '비활성'}
            </span>
          </div>
        </div>
      </div>

      <div className="form-section">
        <label className="field full">
          <span>카테고리명</span>

          <input
            value={draft.name}
            onChange={(event) =>
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      name:
                        event.target.value,
                    }
                  : current,
              )
            }
          />
        </label>

        <label className="field full">
          <span>설명 *</span>

          <textarea
            value={
              draft.description ?? ''
            }
            maxLength={500}
            onChange={(event) =>
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      description:
                        event.target.value,
                    }
                  : current,
              )
            }
          />

          <small>
            {
              (
                draft.description ??
                ''
              ).length
            }
            /500
          </small>
        </label>

        <label className="field full">
          <span>
            포함 테스트 항목 수
          </span>

          <input
            value={`${draft.item_count}개`}
            disabled
          />
        </label>
      </div>

      <OptionSection
        title="기본 적용 플랫폼"
        description="이 카테고리에 새 TC를 생성할 때 기본값으로 적용됩니다."
      >
        <CheckOption
          label="iOS"
          checked={
            draft.default_ios
          }
          onChange={(value) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    default_ios:
                      value,
                  }
                : current,
            )
          }
        />

        <CheckOption
          label="Android"
          checked={
            draft.default_android
          }
          onChange={(value) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    default_android:
                      value,
                  }
                : current,
            )
          }
        />
      </OptionSection>

      <OptionSection
        title="기본 적용 테스트 유형"
        description="신규 TC 생성 시 적용할 테스트 유형의 기본값입니다."
      >
        <CheckOption
          label="신규"
          checked={
            draft.default_new
          }
          onChange={(value) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    default_new:
                      value,
                  }
                : current,
            )
          }
        />

        <CheckOption
          label="재납품"
          checked={
            draft.default_resubmission
          }
          onChange={(value) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    default_resubmission:
                      value,
                  }
                : current,
            )
          }
        />

        <CheckOption
          label="개발 검수"
          checked={
            draft.default_development_review
          }
          onChange={(value) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    default_development_review:
                      value,
                  }
                : current,
            )
          }
        />
      </OptionSection>

      <OptionSection
        title="운영 상태"
        description="비활성화하면 신규 테스트 기준에서 사용하지 않는 상태로 관리합니다."
      >
        <ToggleOption
          checked={
            draft.is_active
          }
          onChange={(value) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    is_active:
                      value,
                  }
                : current,
            )
          }
        />
      </OptionSection>

      <Metadata
        createdAt={
          draft.created_at
        }
        updatedAt={
          draft.updated_at
        }
      />
    </>
  );
}

function TestItemEditor({
  draft,
  setDraft,
  categories,
  pendingChanges,
  resetVersion,
  onAttachmentsChanged,
}: {
  draft: TestItem;
  setDraft: React.Dispatch<
    React.SetStateAction<TestItem | null>
  >;
  categories: Category[];
  pendingChanges: {
    itemId: string;
    newFiles: File[];
    deletedIds: string[];
  } | null;
  resetVersion: number;
  onAttachmentsChanged: (changes: {
    newFiles: File[];
    deletedIds: string[];
  }) => void;
}) {
  const [attachments, setAttachments] =
    useState<TestItemAttachment[]>([]);
  const [attachmentError, setAttachmentError] =
    useState('');
  const [isAttachmentLoading, setIsAttachmentLoading] =
    useState(false);
  const [pendingNewFiles, setPendingNewFiles] =
    useState<File[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] =
    useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadAttachments() {
      const token =
        localStorage.getItem('qa_checker_token');

      if (!token) {
        return;
      }

      setIsAttachmentLoading(true);
      setAttachmentError('');

      try {
        const response = await fetch(
          `http://127.0.0.1:3001/test-items/${draft.id}/attachments`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message ??
              '참고 자료를 불러오지 못했습니다.',
          );
        }

        if (!cancelled) {
          setAttachments(data);
        }
      } catch (error) {
        if (!cancelled) {
          setAttachments([]);
          setAttachmentError(
            error instanceof Error
              ? error.message
              : '참고 자료를 불러오지 못했습니다.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsAttachmentLoading(false);
        }
      }
    }

    setPendingNewFiles(
      pendingChanges?.newFiles ?? [],
    );
    setPendingDeleteIds(
      pendingChanges?.deletedIds ?? [],
    );

    void loadAttachments();

    return () => {
      cancelled = true;
    };
  }, [draft.id, resetVersion]);

  function handleAttachmentUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file) {
      return;
    }

    const visibleExistingCount =
      attachments.filter(
        (attachment) =>
          !pendingDeleteIds.includes(
            attachment.id,
          ),
      ).length;

    if (
      visibleExistingCount +
        pendingNewFiles.length >=
      3
    ) {
      setAttachmentError(
        'TC당 참고 자료는 최대 3개까지 등록할 수 있습니다.',
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAttachmentError(
        '파일당 최대 용량은 5MB입니다.',
      );
      return;
    }

    const nextNewFiles = [
      ...pendingNewFiles,
      file,
    ];

    setPendingNewFiles(nextNewFiles);
    setAttachmentError('');

    onAttachmentsChanged({
      newFiles: nextNewFiles,
      deletedIds: pendingDeleteIds,
    });
  }

  function handleAttachmentDelete(
    attachment: TestItemAttachment,
  ) {
    const confirmed = window.confirm(
      `${attachment.original_name}\n참고 자료를 삭제할까요?`,
    );

    if (!confirmed) {
      return;
    }

    const nextDeletedIds = [
      ...pendingDeleteIds,
      attachment.id,
    ];

    setPendingDeleteIds(
      nextDeletedIds,
    );
    setAttachmentError('');

    onAttachmentsChanged({
      newFiles: pendingNewFiles,
      deletedIds: nextDeletedIds,
    });
  }

  function handlePendingFileRemove(
    index: number,
  ) {
    const nextNewFiles =
      pendingNewFiles.filter(
        (_file, fileIndex) =>
          fileIndex !== index,
      );

    setPendingNewFiles(nextNewFiles);

    if (
      nextNewFiles.length === 0 &&
      pendingDeleteIds.length === 0
    ) {
      onAttachmentsChanged({
        newFiles: [],
        deletedIds: [],
      });
      return;
    }

    onAttachmentsChanged({
      newFiles: nextNewFiles,
      deletedIds: pendingDeleteIds,
    });
  }

  async function handleAttachmentOpen(
    attachment: TestItemAttachment,
  ) {
    const token =
      localStorage.getItem('qa_checker_token');

    if (!token) {
      setAttachmentError(
        '로그인 정보가 없습니다. 다시 로그인해주세요.',
      );
      return;
    }

    setAttachmentError('');

    try {
      const response = await fetch(
        `http://127.0.0.1:3001/test-items/${draft.id}/attachments/${attachment.id}/file`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        let message =
          '참고 자료를 열지 못했습니다.';

        try {
          const data = await response.json();
          message =
            data?.message ?? message;
        } catch {
          // 파일 응답이 아닌 오류 응답만 확인합니다.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const objectUrl =
        URL.createObjectURL(blob);

      window.open(
        objectUrl,
        '_blank',
        'noopener,noreferrer',
      );

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 60_000);
    } catch (error) {
      setAttachmentError(
        error instanceof Error
          ? error.message
          : '참고 자료를 열지 못했습니다.',
      );
    }
  }

  function formatFileSize(
    value: string | number,
  ) {
    const bytes = Number(value);

    if (!Number.isFinite(bytes)) {
      return '-';
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(
        bytes / 1024
      ).toFixed(1)} KB`;
    }

    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  const visibleAttachments =
    attachments.filter(
      (attachment) =>
        !pendingDeleteIds.includes(
          attachment.id,
        ),
    );

  return (
    <>
      <div className="editor-heading">
        <div>
          <span className="editor-type">
            TEST CASE
          </span>

          <div className="editor-title-row">
            <span className="tc-heading-code">
              {draft.tc_code}
            </span>

            <h2>{draft.title}</h2>

            <span
              className={
                draft.is_active
                  ? 'state-badge active'
                  : 'state-badge inactive'
              }
            >
              {draft.is_active
                ? '활성'
                : '비활성'}
            </span>
          </div>

          <p>
            {draft.category_name}
          </p>
        </div>
      </div>

      <div className="form-section">
        <label className="field full">
          <span>TC 번호</span>

          <input
            value={draft.tc_code}
            disabled
          />
        </label>

        <label className="field full">
          <span>카테고리</span>

          <select
            value={
              draft.category_id
            }
            onChange={(event) => {
              const category =
                categories.find(
                  (current) =>
                    current.id ===
                    event.target
                      .value,
                );

              setDraft(
                (current) =>
                  current && category
                    ? {
                        ...current,
                        category_id:
                          category.id,
                        category_name:
                          category.name,
                      }
                    : current,
              );
            }}
          >
            {categories.map(
              (category) => (
                <option
                  key={category.id}
                  value={category.id}
                >
                  {category.name}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="field full">
          <span>TC명</span>

          <input
            value={draft.title}
            onChange={(event) =>
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      title:
                        event.target.value,
                    }
                  : current,
              )
            }
          />
        </label>

        <label className="field full">
          <span>체크 내용</span>

          <textarea
            value={
              draft.check_content
            }
            onChange={(event) =>
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      check_content:
                        event.target.value,
                    }
                  : current,
              )
            }
          />
        </label>

        <label className="field full">
          <span>테스트 방법</span>

          <textarea
            className="large"
            value={
              splitTestMethod(
                draft.test_method,
              ).description
            }
            onChange={(event) =>
              setDraft((current) => {
                if (!current) {
                  return current;
                }

                const parsed =
                  splitTestMethod(
                    current.test_method,
                  );

                return {
                  ...current,
                  test_method:
                    combineTestMethod(
                      event.target.value,
                      parsed.operationSteps,
                    ),
                };
              })
            }
          />
        </label>

        <label className="field full">
          <span>조작 순서</span>

          <textarea
            value={
              splitTestMethod(
                draft.test_method,
              ).operationSteps
            }
            onChange={(event) =>
              setDraft((current) => {
                if (!current) {
                  return current;
                }

                const parsed =
                  splitTestMethod(
                    current.test_method,
                  );

                return {
                  ...current,
                  test_method:
                    combineTestMethod(
                      parsed.description,
                      event.target.value,
                    ),
                };
              })
            }
            placeholder="예: 게임 플레이 진행 > 단말 네트워크 차단 > 게임 화면 복귀 > 팝업 확인 > 재접속"
          />
        </label>

        <section className="attachment-section">
          <div className="attachment-heading">
            <div>
              <strong>참고 자료</strong>
              <span>
                이미지 또는 PDF · 최대 3개 · 파일당 5MB · 저장 전 변경 취소 가능
              </span>
            </div>

            <label
              className={
                attachments.filter(
                  (attachment) =>
                    !pendingDeleteIds.includes(
                      attachment.id,
                    ),
                ).length +
                  pendingNewFiles.length >=
                3
                  ? 'attachment-upload disabled'
                  : 'attachment-upload'
              }
            >
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
                disabled={
                  attachments.filter(
                    (attachment) =>
                      !pendingDeleteIds.includes(
                        attachment.id,
                      ),
                  ).length +
                    pendingNewFiles.length >=
                  3
                }
                onChange={
                  handleAttachmentUpload
                }
              />

              + 파일 추가
            </label>
          </div>

          {attachmentError && (
            <div className="attachment-error">
              {attachmentError}
            </div>
          )}

          {isAttachmentLoading ? (
            <div className="attachment-empty">
              참고 자료를 불러오는 중...
            </div>
          ) : visibleAttachments.length === 0 &&
            pendingNewFiles.length === 0 ? (
            <div className="attachment-empty">
              등록된 참고 자료가 없습니다.
            </div>
          ) : (
            <div className="attachment-list">
              {visibleAttachments.map(
                (attachment) => {
                  const isImage =
                    attachment.mime_type.startsWith(
                      'image/',
                    );

                  return (
                    <div
                      key={attachment.id}
                      className="attachment-item"
                    >
                      <button
                        type="button"
                        className="attachment-open"
                        onClick={() =>
                          handleAttachmentOpen(
                            attachment,
                          )
                        }
                        title="새 탭에서 열기"
                      >
                        <span className="attachment-type">
                          {isImage
                            ? 'IMG'
                            : 'PDF'}
                        </span>

                        <span className="attachment-info">
                          <strong>
                            {
                              attachment.original_name
                            }
                          </strong>

                          <small>
                            {formatFileSize(
                              attachment.file_size,
                            )}
                          </small>
                        </span>
                      </button>

                      <button
                        type="button"
                        className="attachment-delete"
                        onClick={() =>
                          handleAttachmentDelete(
                            attachment,
                          )
                        }
                        aria-label={`${attachment.original_name} 삭제`}
                        title="삭제"
                      >
                        ×
                      </button>
                    </div>
                  );
                },
              )}

              {pendingNewFiles.map(
                (file, index) => (
                  <div
                    key={`${file.name}-${file.size}-${index}`}
                    className="attachment-item pending"
                  >
                    <div className="attachment-open staged">
                      <span className="attachment-type">
                        {file.type.startsWith(
                          'image/',
                        )
                          ? 'IMG'
                          : 'PDF'}
                      </span>

                      <span className="attachment-info">
                        <strong>
                          {file.name}
                        </strong>

                        <small>
                          저장 대기 · {formatFileSize(
                            file.size,
                          )}
                        </small>
                      </span>
                    </div>

                    <button
                      type="button"
                      className="attachment-delete"
                      onClick={() =>
                        handlePendingFileRemove(
                          index,
                        )
                      }
                      aria-label={`${file.name} 추가 취소`}
                      title="추가 취소"
                    >
                      ×
                    </button>
                  </div>
                ),
              )}
            </div>
          )}
        </section>
      </div>

      <OptionSection
        title="적용 플랫폼"
        description="이 TC가 포함될 플랫폼을 선택합니다."
      >
        <CheckOption
          label="iOS"
          checked={
            draft.applies_ios
          }
          onChange={(value) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    applies_ios:
                      value,
                  }
                : current,
            )
          }
        />

        <CheckOption
          label="Android"
          checked={
            draft.applies_android
          }
          onChange={(value) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    applies_android:
                      value,
                  }
                : current,
            )
          }
        />
      </OptionSection>

      <OptionSection
        title="적용 테스트 유형"
        description="이 TC가 적용되는 테스트 유형을 선택합니다."
      >
        <CheckOption
          label="신규"
          checked={
            draft.applies_new
          }
          onChange={(value) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    applies_new:
                      value,
                  }
                : current,
            )
          }
        />

        <CheckOption
          label="재납품"
          checked={
            draft.applies_resubmission
          }
          onChange={(value) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    applies_resubmission:
                      value,
                  }
                : current,
            )
          }
        />

        <CheckOption
          label="개발 검수"
          checked={
            draft.applies_development_review
          }
          onChange={(value) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    applies_development_review:
                      value,
                  }
                : current,
            )
          }
        />
      </OptionSection>

      <OptionSection
        title="운영 상태"
        description="과거 테스트 이력을 보존하기 위해 사용된 TC는 삭제보다 비활성화를 권장합니다."
      >
        <ToggleOption
          checked={
            draft.is_active
          }
          onChange={(value) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    is_active:
                      value,
                  }
                : current,
            )
          }
        />
      </OptionSection>

      <Metadata
        createdAt={
          draft.created_at
        }
        updatedAt={
          draft.updated_at
        }
      />
    </>
  );
}


function CreateCategoryForm({
  draft,
  setDraft,
}: {
  draft: CreateCategoryDraft;
  setDraft: React.Dispatch<
    React.SetStateAction<CreateCategoryDraft>
  >;
}) {
  return (
    <>
      <label className="field full">
        <span>카테고리명 *</span>

        <input
          value={draft.name}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              name:
                event.target.value,
            }))
          }
          placeholder="예: 결제 / 네트워크 / UI"
        />
      </label>

      <label className="field full">
        <span>설명</span>

        <textarea
          value={
            draft.description
          }
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              description:
                event.target.value,
            }))
          }
        />
      </label>

      <ModalOptionBlock
        title="기본 적용 플랫폼"
      >
        <CheckOption
          label="iOS"
          checked={
            draft.defaultIos
          }
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              defaultIos:
                value,
            }))
          }
        />

        <CheckOption
          label="Android"
          checked={
            draft.defaultAndroid
          }
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              defaultAndroid:
                value,
            }))
          }
        />
      </ModalOptionBlock>

      <ModalOptionBlock
        title="기본 적용 테스트 유형"
      >
        <CheckOption
          label="신규"
          checked={
            draft.defaultNew
          }
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              defaultNew:
                value,
            }))
          }
        />

        <CheckOption
          label="재납품"
          checked={
            draft.defaultResubmission
          }
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              defaultResubmission:
                value,
            }))
          }
        />

        <CheckOption
          label="개발 검수"
          checked={
            draft.defaultDevelopmentReview
          }
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              defaultDevelopmentReview:
                value,
            }))
          }
        />
      </ModalOptionBlock>
    </>
  );
}

function CreateItemForm({
  draft,
  setDraft,
  categories,
  onCategoryChange,
  attachmentFiles,
  setAttachmentFiles,
}: {
  draft: CreateItemDraft;
  setDraft: React.Dispatch<
    React.SetStateAction<CreateItemDraft>
  >;
  categories: Category[];
  onCategoryChange: (
    categoryId: string,
  ) => void;
  attachmentFiles: File[];
  setAttachmentFiles: React.Dispatch<
    React.SetStateAction<File[]>
  >;
}) {
  return (
    <>
      <label className="field full">
        <span>카테고리 *</span>

        <select
          value={
            draft.categoryId
          }
          onChange={(event) =>
            onCategoryChange(
              event.target.value,
            )
          }
        >
          {categories.map(
            (category) => (
              <option
                key={category.id}
                value={category.id}
              >
                {category.name}
              </option>
            ),
          )}
        </select>
      </label>

      <div className="auto-number-guide">
        TC 번호는 생성 시 자동으로
        부여됩니다.
      </div>

      <label className="field full">
        <span>TC명 *</span>

        <input
          value={draft.title}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              title:
                event.target.value,
            }))
          }
        />
      </label>

      <label className="field full">
        <span>체크 내용 *</span>

        <textarea
          value={
            draft.checkContent
          }
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              checkContent:
                event.target.value,
            }))
          }
        />
      </label>

      <label className="field full">
        <span>테스트 방법 *</span>

        <textarea
          className="large"
          value={
            draft.testMethod
          }
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              testMethod:
                event.target.value,
            }))
          }
        />
      </label>

      <label className="field full">
        <span>조작 순서</span>

        <textarea
          value={
            draft.operationSteps
          }
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              operationSteps:
                event.target.value,
            }))
          }
          placeholder="선택 입력 · 예: 게임 플레이 진행 > 단말 네트워크 차단 > 게임 화면 복귀 > 팝업 확인 > 재접속"
        />
      </label>

      <section className="attachment-section create-attachment-section">
        <div className="attachment-heading">
          <div>
            <strong>참고 자료</strong>
            <span>
              선택 입력 · 이미지 또는 PDF · 최대 3개 · 파일당 5MB
            </span>
          </div>

          <label
            className={
              attachmentFiles.length >= 3
                ? 'attachment-upload disabled'
                : 'attachment-upload'
            }
          >
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
              disabled={
                attachmentFiles.length >= 3
              }
              onChange={(event) => {
                const file =
                  event.target.files?.[0];

                event.target.value = '';

                if (!file) {
                  return;
                }

                if (
                  file.size >
                  5 * 1024 * 1024
                ) {
                  window.alert(
                    '파일당 최대 용량은 5MB입니다.',
                  );
                  return;
                }

                setAttachmentFiles(
                  (current) => [
                    ...current,
                    file,
                  ].slice(0, 3),
                );
              }}
            />

            + 파일 추가
          </label>
        </div>

        {attachmentFiles.length === 0 ? (
          <div className="attachment-empty">
            생성과 함께 등록할 참고 자료가 없습니다.
          </div>
        ) : (
          <div className="attachment-list">
            {attachmentFiles.map(
              (file, index) => (
                <div
                  key={`${file.name}-${file.size}-${index}`}
                  className="attachment-item"
                >
                  <div className="attachment-open staged">
                    <span className="attachment-type">
                      {file.type.startsWith(
                        'image/',
                      )
                        ? 'IMG'
                        : 'PDF'}
                    </span>

                    <span className="attachment-info">
                      <strong>
                        {file.name}
                      </strong>

                      <small>
                        {file.size < 1024 * 1024
                          ? `${(
                              file.size / 1024
                            ).toFixed(1)} KB`
                          : `${(
                              file.size /
                              (1024 * 1024)
                            ).toFixed(1)} MB`}
                      </small>
                    </span>
                  </div>

                  <button
                    type="button"
                    className="attachment-delete"
                    onClick={() =>
                      setAttachmentFiles(
                        (current) =>
                          current.filter(
                            (_item, itemIndex) =>
                              itemIndex !== index,
                          ),
                      )
                    }
                    aria-label={`${file.name} 제거`}
                    title="제거"
                  >
                    ×
                  </button>
                </div>
              ),
            )}
          </div>
        )}
      </section>

      <ModalOptionBlock
        title="적용 플랫폼"
      >
        <CheckOption
          label="iOS"
          checked={
            draft.appliesIos
          }
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              appliesIos:
                value,
            }))
          }
        />

        <CheckOption
          label="Android"
          checked={
            draft.appliesAndroid
          }
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              appliesAndroid:
                value,
            }))
          }
        />
      </ModalOptionBlock>

      <ModalOptionBlock
        title="적용 테스트 유형"
      >
        <CheckOption
          label="신규"
          checked={
            draft.appliesNew
          }
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              appliesNew:
                value,
            }))
          }
        />

        <CheckOption
          label="재납품"
          checked={
            draft.appliesResubmission
          }
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              appliesResubmission:
                value,
            }))
          }
        />

        <CheckOption
          label="개발 검수"
          checked={
            draft.appliesDevelopmentReview
          }
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              appliesDevelopmentReview:
                value,
            }))
          }
        />
      </ModalOptionBlock>
    </>
  );
}

function ModalOptionBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="modal-option-block">
      <strong>{title}</strong>

      <div>{children}</div>

      <style jsx>{styles}</style>
    </section>
  );
}

function OptionSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="option-section">
      <h3>{title}</h3>
      <p>{description}</p>

      <div className="option-list">
        {children}
      </div>

      <style jsx>{styles}</style>
    </section>
  );
}

function CheckOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (
    value: boolean,
  ) => void;
}) {
  return (
    <label className="check-option">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked,
          )
        }
      />

      <span>{label}</span>

      <style jsx>{styles}</style>
    </label>
  );
}

function ToggleOption({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (
    value: boolean,
  ) => void;
}) {
  return (
    <label className="toggle-option">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked,
          )
        }
      />

      <span className="toggle-track">
        <i />
      </span>

      <strong>
        {checked
          ? '활성'
          : '비활성'}
      </strong>

      <style jsx>{styles}</style>
    </label>
  );
}

function Metadata({
  createdAt,
  updatedAt,
}: {
  createdAt: string;
  updatedAt: string;
}) {
  return (
    <section className="metadata">
      <h3>생성 / 수정 정보</h3>

      <div>
        <span>
          생성일
          <strong>
            {formatDate(
              createdAt,
            )}
          </strong>
        </span>

        <span>
          수정일
          <strong>
            {formatDate(
              updatedAt,
            )}
          </strong>
        </span>
      </div>

      <style jsx>{styles}</style>
    </section>
  );
}

const styles = `
* {
  box-sizing: border-box;
}

.management-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  color: #737d8a;
}

.account-area {
  padding: 18px 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.menu-area {
  padding-top: 20px;
}

.management-main {
  min-width: 0;
  min-height: 100vh;
  padding: 38px 40px 50px;
  background: #f5f7fa;
}

.page-header {
  margin-bottom: 24px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 30px;
}

.page-eyebrow {
  display: block;
  margin-bottom: 7px;
  color: #8799b2;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
}

.page-header h1 {
  margin: 0;
  color: #202733;
  font-size: 27px;
}

.page-header p {
  margin: 9px 0 0;
  color: #7b8491;
  font-size: 12px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-actions button {
  height: 38px;
  padding: 0 17px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

.cancel-button {
  border: 1px solid #d7dde5;
  background: #ffffff;
  color: #536071;
}

.save-button {
  border: 1px solid #315e99;
  background: #315e99;
  color: #ffffff;
}

.header-actions button:disabled {
  opacity: 0.4;
  cursor: default;
}

.message {
  margin-bottom: 16px;
  padding: 12px 15px;
  border-radius: 9px;
  font-size: 10px;
}

.message.error {
  border: 1px solid #ecd4d4;
  background: #fbf4f4;
  color: #925858;
}

.message.success {
  border: 1px solid #d4e5da;
  background: #f3f8f5;
  color: #55705f;
}

.management-layout {
  min-height: 680px;
  display: grid;
  grid-template-columns:
    350px
    minmax(0, 1fr);
  border: 1px solid #dfe4ea;
  border-radius: 14px;
  overflow: hidden;
  background: #ffffff;
}

.tree-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e2e6eb;
  background: #fbfcfd;
}

.tree-heading {
  min-height: 76px;
  padding: 18px 18px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e5e9ee;
}

.tree-heading span {
  color: #8a99ae;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 1px;
}

.tree-heading h2 {
  margin: 5px 0 0;
  font-size: 15px;
}

.refresh-button {
  width: 32px;
  height: 32px;
  border: 1px solid #dce2e8;
  border-radius: 8px;
  background: #ffffff;
  color: #647286;
  font-size: 18px;
  cursor: pointer;
}

.refresh-button:disabled {
  opacity: 0.4;
  cursor: default;
}

.refresh-button.spinning {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.tree-tools {
  padding: 12px 14px;
  border-bottom: 1px solid #e7ebef;
}

.create-button {
  width: 100%;
  height: 34px;
  margin-bottom: 9px;
  border: 0;
  border-radius: 8px;
  background: #315e99;
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
}

.search-box {
  height: 34px;
  padding: 0 9px;
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid #dce2e8;
  border-radius: 8px;
  background: #ffffff;
}

.search-box > span {
  color: #8d98a6;
}

.search-box input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  color: #3d4857;
  font-size: 9px;
}

.search-box button {
  border: 0;
  background: transparent;
  color: #8f99a6;
  cursor: pointer;
}

.tree-list {
  flex: 1;
  padding: 12px;
  overflow: auto;
}

.tree-category {
  margin-bottom: 7px;
}

.category-row {
  min-height: 42px;
  display: grid;
  grid-template-columns:
    28px
    minmax(0, 1fr)
    auto;
  align-items: center;
  border-radius: 8px;
}

.category-row.selected {
  background: #eaf1fa;
}

.category-row.inactive,
.item-row.inactive {
  opacity: 0.48;
}

.collapse-button {
  width: 28px;
  height: 28px;
  border: 0;
  background: transparent;
  color: #64758b;
  font-size: 17px;
  cursor: pointer;
}

.category-select {
  min-width: 0;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: #2d3745;
  text-align: left;
  cursor: pointer;
}

.category-select strong {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.active-dot,
.inactive-dot {
  width: 8px;
  height: 8px;
  display: inline-block;
  flex: 0 0 auto;
  border-radius: 50%;
}

.active-dot {
  background: #64a77c;
}

.inactive-dot {
  background: #bcc3cc;
}

.active-dot.small,
.inactive-dot.small {
  width: 6px;
  height: 6px;
}

.count-badge {
  min-width: 25px;
  margin-right: 8px;
  padding: 4px 7px;
  border-radius: 999px;
  background: #ffffff;
  color: #788494;
  font-size: 9px;
  text-align: center;
}

.tree-items {
  padding: 3px 0 3px 29px;
}

.item-row {
  width: 100%;
  min-height: 38px;
  padding: 0 9px;
  display: grid;
  grid-template-columns:
    7px
    58px
    minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #566273;
  font-size: 9px;
  text-align: left;
  cursor: pointer;
}

.item-row.selected {
  background: #edf2f8;
  color: #284f82;
  font-weight: 800;
}

.item-row:hover,
.category-row:hover {
  background: #f0f3f7;
}

.category-row.selected:hover {
  background: #eaf1fa;
}

.tc-code {
  color: #6b7f9c;
  font-size: 8px;
  font-weight: 800;
}

.tc-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-items,
.empty-tree {
  padding: 18px 10px;
  color: #a0a8b3;
  font-size: 9px;
  text-align: center;
}

.tree-footer {
  min-height: 48px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-top: 1px solid #e5e9ee;
  color: #8c96a4;
  font-size: 8px;
}

.tree-footer span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.tree-footer strong {
  margin-left: auto;
  color: #738092;
  font-size: 8px;
}

.editor-panel {
  min-width: 0;
  padding: 26px 30px 32px;
  background: #ffffff;
}

.editor-heading {
  padding-bottom: 20px;
  border-bottom: 1px solid #e6eaee;
}

.editor-type {
  color: #8799b2;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 1px;
}

.editor-title-row {
  margin-top: 7px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.editor-title-row h2 {
  margin: 0;
  font-size: 22px;
}

.tc-heading-code {
  padding: 5px 8px;
  border-radius: 6px;
  background: #edf2f8;
  color: #526d92;
  font-size: 9px;
  font-weight: 800;
}

.editor-heading p {
  margin: 7px 0 0;
  color: #85909f;
  font-size: 10px;
}

.state-badge {
  padding: 5px 8px;
  border-radius: 999px;
  font-size: 8px;
  font-weight: 800;
}

.state-badge.active {
  background: #edf5f0;
  color: #55715f;
}

.state-badge.inactive {
  background: #f0f2f5;
  color: #828c98;
}

.form-section {
  padding: 24px 0;
  border-bottom: 1px solid #e7ebef;
}

.two-column {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.field {
  position: relative;
  margin-bottom: 17px;
  display: flex;
  flex-direction: column;
}

.field:last-child {
  margin-bottom: 0;
}

.field > span {
  margin-bottom: 7px;
  color: #505d6d;
  font-size: 10px;
  font-weight: 800;
}

.field input,
.field textarea,
.field select {
  width: 100%;
  border: 1px solid #dce2e8;
  border-radius: 8px;
  background: #ffffff;
  color: #354052;
  outline: none;
  font-family: inherit;
  font-size: 11px;
}

.field input,
.field select {
  height: 38px;
  padding: 0 12px;
}

.field textarea {
  min-height: 92px;
  padding: 12px;
  resize: vertical;
  line-height: 1.7;
}

.field textarea.large {
  min-height: 145px;
}

.field input:focus,
.field textarea:focus,
.field select:focus {
  border-color: #8fa9ca;
  box-shadow:
    0 0 0 3px
    rgba(75, 112, 160, 0.08);
}

.field input:disabled {
  background: #f5f6f8;
  color: #8f98a4;
}

.field small {
  position: absolute;
  right: 10px;
  bottom: 8px;
  color: #9ca5b0;
  font-size: 8px;
}

.order-field {
  max-width: 220px;
}

.attachment-section {
  margin-top: 22px;
  padding: 17px;
  border: 1px solid #dfe5ec;
  border-radius: 10px;
  background: #fafbfd;
}

.attachment-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.attachment-heading > div {
  min-width: 0;
}

.attachment-heading strong {
  display: block;
  color: #3f4c5c;
  font-size: 11px;
}

.attachment-heading span {
  display: block;
  margin-top: 4px;
  color: #8b96a5;
  font-size: 8px;
}

.attachment-upload {
  min-width: 82px;
  height: 32px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #b9cbe0;
  border-radius: 7px;
  background: #f2f6fb;
  color: #315e99;
  font-size: 9px;
  font-weight: 800;
  cursor: pointer;
}

.attachment-upload input {
  display: none;
}

.attachment-upload.disabled {
  opacity: 0.45;
  cursor: default;
}

.attachment-error {
  margin-top: 12px;
  padding: 9px 11px;
  border: 1px solid #ecd4d4;
  border-radius: 7px;
  background: #fff6f6;
  color: #985858;
  font-size: 9px;
  line-height: 1.5;
}

.attachment-empty {
  margin-top: 12px;
  padding: 15px 12px;
  border: 1px dashed #d8dfe7;
  border-radius: 8px;
  color: #9aa4b0;
  font-size: 9px;
  text-align: center;
}

.attachment-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.attachment-item.pending {
  border-style: dashed;
  background: #f8fbff;
}

.attachment-item {
  min-height: 48px;
  padding: 7px 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #e2e7ed;
  border-radius: 8px;
  background: #ffffff;
}

.attachment-open {
  min-width: 0;
  flex: 1;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.attachment-type {
  width: 36px;
  height: 28px;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  margin: 0 !important;
  border-radius: 6px;
  background: #edf2f8;
  color: #526f95 !important;
  font-size: 7px !important;
  font-weight: 900 !important;
  letter-spacing: 0.4px;
}

.attachment-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.attachment-info strong {
  overflow: hidden;
  color: #475466;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-info small {
  position: static !important;
  margin-top: 3px;
  color: #9aa4b0;
  font-size: 8px;
}

.attachment-open.staged {
  cursor: default;
}

.create-attachment-section {
  margin-bottom: 18px;
}

.attachment-delete {
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border: 1px solid #e5d4d4;
  border-radius: 6px;
  background: #fffafa;
  color: #a26666;
  font-size: 15px;
  cursor: pointer;
}

.attachment-delete:hover {
  background: #fff1f1;
}

.option-section {
  padding: 22px 0;
  border-bottom: 1px solid #e7ebef;
}

.option-section h3 {
  margin: 0;
  font-size: 12px;
}

.option-section p {
  margin: 6px 0 14px;
  color: #8a94a1;
  font-size: 9px;
}

.option-list {
  display: flex;
  flex-wrap: wrap;
  gap: 25px;
}

.check-option {
  min-width: 110px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #475364;
  font-size: 10px;
  cursor: pointer;
}

.check-option input {
  width: 15px;
  height: 15px;
  accent-color: #426fa9;
}

.toggle-option {
  display: flex;
  align-items: center;
  gap: 9px;
  cursor: pointer;
}

.toggle-option input {
  display: none;
}

.toggle-track {
  width: 34px;
  height: 19px;
  padding: 2px;
  display: block;
  border-radius: 999px;
  background: #c8ced6;
  transition: 0.15s ease;
}

.toggle-track i {
  width: 15px;
  height: 15px;
  display: block;
  border-radius: 50%;
  background: #ffffff;
  transition: 0.15s ease;
}

.toggle-option input:checked + .toggle-track {
  background: #5e82ad;
}

.toggle-option input:checked + .toggle-track i {
  transform: translateX(15px);
}

.toggle-option strong {
  font-size: 10px;
}

.metadata {
  padding-top: 22px;
}

.metadata h3 {
  margin: 0 0 14px;
  font-size: 11px;
}

.metadata > div {
  display: flex;
  gap: 45px;
}

.metadata span {
  color: #8b95a2;
  font-size: 9px;
}

.metadata strong {
  margin-left: 8px;
  color: #566170;
  font-weight: 700;
}

.empty-editor {
  min-height: 500px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #818c9b;
}

.empty-editor strong {
  font-size: 14px;
}

.empty-editor p {
  margin: 7px 0 0;
  font-size: 10px;
}

.management-guide {
  margin-top: 18px;
  padding: 16px 20px;
  border: 1px solid #cfdbeb;
  border-radius: 10px;
  background: #f8fbff;
}

.management-guide > strong {
  display: block;
  margin-bottom: 8px;
  color: #496b98;
  font-size: 10px;
}

.management-guide p {
  margin: 4px 0;
  color: #68778a;
  font-size: 9px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  padding: 35px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(22, 29, 39, 0.45);
}

.create-modal {
  width: min(620px, 100%);
  max-height: calc(100vh - 70px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 15px;
  background: #ffffff;
  box-shadow:
    0 25px 70px
    rgba(15, 23, 42, 0.18);
}

.modal-heading {
  padding: 20px 23px 15px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  border-bottom: 1px solid #e7ebef;
}

.modal-heading span {
  color: #8799b2;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 1px;
}

.modal-heading h2 {
  margin: 5px 0 0;
  font-size: 20px;
}

.modal-heading > button {
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 7px;
  background: #f1f3f6;
  color: #667284;
  font-size: 18px;
  cursor: pointer;
}

.create-type {
  padding: 14px 23px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
  border-bottom: 1px solid #e7ebef;
}

.create-type button {
  height: 36px;
  border: 1px solid #dce2e8;
  border-radius: 8px;
  background: #ffffff;
  color: #657184;
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
}

.create-type button.active {
  border-color: #7f9fc7;
  background: #edf3fa;
  color: #315e99;
}

.modal-body {
  padding: 21px 23px;
  overflow-y: auto;
}

.modal-error-message {
  margin-bottom: 16px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid #eccaca;
  border-radius: 8px;
  background: #fff5f5;
  color: #9a4f4f;
  font-size: 9px;
  line-height: 1.5;
}

.modal-error-message strong {
  color: #7f3f3f;
  font-size: 10px;
}

.modal-option-block {
  margin-top: 18px;
  padding-top: 17px;
  border-top: 1px solid #e8ebef;
}

.modal-option-block > strong {
  display: block;
  margin-bottom: 12px;
  font-size: 10px;
}

.modal-option-block > div {
  display: flex;
  flex-wrap: wrap;
  gap: 22px;
}

.auto-number-guide {
  margin: -6px 0 16px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f4f7fb;
  color: #6a7990;
  font-size: 9px;
}

.modal-footer {
  padding: 14px 23px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid #e7ebef;
}

.modal-footer button {
  height: 36px;
  padding: 0 17px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
}

.modal-cancel {
  border: 1px solid #d7dde5;
  background: #ffffff;
  color: #657184;
}

.modal-create {
  border: 0;
  background: #315e99;
  color: #ffffff;
}

@media (max-width: 1050px) {
  .management-layout {
    grid-template-columns:
      300px
      minmax(0, 1fr);
  }

  .management-main {
    padding: 30px 24px;
  }
}

@media (max-width: 800px) {
  .management-layout {
    grid-template-columns: 1fr;
  }

  .tree-panel {
    border-right: 0;
    border-bottom: 1px solid #e2e6eb;
  }

  .tree-list {
    max-height: 320px;
  }

  .page-header {
    flex-direction: column;
  }

  .two-column {
    grid-template-columns: 1fr;
  }

  .modal-backdrop {
    align-items: flex-start;
  }
}
`;