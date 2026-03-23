"""
train.py — Transfer learning model trainer for interior design style classification.

Architecture: MobileNetV2 (ImageNet pretrained) → GlobalAveragePooling → Dense(256) → Dropout → Dense(12, softmax)
Classes: 12 (3 room types × 4 styles)
Input: dataset/manifest.json + dataset/images/**/*.jpg  (built by scraper.js)
Output: model/  (TensorFlow.js LayersModel format, loadable in browser)

Requirements:
    pip install tensorflow tensorflowjs pillow numpy scikit-learn

Usage:
    python train.py
    python train.py --epochs 20 --batch 32 --fine-tune
"""

import os
import sys
import json
import argparse
import numpy as np
from pathlib import Path

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.preprocessing.image import load_img, img_to_array
from sklearn.model_selection import train_test_split

# ── Config ────────────────────────────────────────────────────────────────────
IMG_SIZE    = 224          # MobileNetV2 native input size
BATCH_SIZE  = 16
EPOCHS      = 15
FINE_TUNE_EPOCHS = 10
FINE_TUNE_AT     = 100    # unfreeze layers from this index onward during fine-tuning
DATASET_DIR = Path('dataset')
MODEL_OUT   = Path('model')

CLASSES = [
    'living_modern', 'living_minimal', 'living_traditional', 'living_luxury',
    'bedroom_modern', 'bedroom_minimal', 'bedroom_traditional', 'bedroom_luxury',
    'kitchen_modern', 'kitchen_minimal', 'kitchen_traditional', 'kitchen_luxury',
]
NUM_CLASSES = len(CLASSES)
CLASS_INDEX = {c: i for i, c in enumerate(CLASSES)}

# ── Data loading ──────────────────────────────────────────────────────────────
def load_dataset(manifest_path: Path):
    """Load images and labels from the manifest produced by scraper.js."""
    with open(manifest_path) as f:
        manifest = json.load(f)

    images, labels = [], []
    skipped = 0

    for item in manifest['items']:
        img_path = Path(item['filePath'])
        if not img_path.exists():
            skipped += 1
            continue
        try:
            img = load_img(img_path, target_size=(IMG_SIZE, IMG_SIZE))
            arr = img_to_array(img)                  # (224, 224, 3) float32 0-255
            images.append(arr)
            labels.append(CLASS_INDEX[item['label']])
        except Exception as e:
            print(f'  Warning: could not load {img_path}: {e}')
            skipped += 1

    print(f'Loaded {len(images)} images, skipped {skipped}')
    X = np.array(images, dtype=np.float32)
    y = np.array(labels, dtype=np.int32)
    return X, y


def preprocess(X):
    """Scale to [-1, 1] as expected by MobileNetV2."""
    return (X / 127.5) - 1.0


def augment_layer():
    """Keras Sequential augmentation pipeline applied during training."""
    return keras.Sequential([
        layers.RandomFlip('horizontal'),
        layers.RandomRotation(0.08),
        layers.RandomZoom(0.10),
        layers.RandomBrightness(0.15),
        layers.RandomContrast(0.15),
    ], name='augmentation')


# ── Model ─────────────────────────────────────────────────────────────────────
def build_model(num_classes: int, trainable_base: bool = False):
    """
    Transfer learning model:
      MobileNetV2 (frozen) → GlobalAveragePooling2D → Dense(256, relu) → Dropout(0.4) → Dense(num_classes, softmax)
    """
    base = MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights='imagenet'
    )
    base.trainable = trainable_base

    inputs = keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    x = augment_layer()(inputs)
    x = base(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dense(256, activation='relu')(x)
    x = layers.Dropout(0.4)(x)
    outputs = layers.Dense(num_classes, activation='softmax')(x)

    model = keras.Model(inputs, outputs)
    return model, base


# ── Training ──────────────────────────────────────────────────────────────────
def train(args):
    manifest_path = DATASET_DIR / 'manifest.json'
    if not manifest_path.exists():
        print('ERROR: dataset/manifest.json not found. Run scraper.js first.')
        sys.exit(1)

    print('Loading dataset…')
    X, y = load_dataset(manifest_path)
    X = preprocess(X)

    # One-hot encode labels
    y_cat = keras.utils.to_categorical(y, NUM_CLASSES)

    X_train, X_val, y_train, y_val = train_test_split(
        X, y_cat, test_size=0.2, random_state=42, stratify=y
    )
    print(f'Train: {len(X_train)}  Val: {len(X_val)}')

    # ── Phase 1: Train head only (base frozen) ────────────────────────────────
    print('\n── Phase 1: Training classification head (base frozen) ──')
    model, base = build_model(NUM_CLASSES, trainable_base=False)
    model.compile(
        optimizer=keras.optimizers.Adam(1e-3),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    model.summary()

    callbacks = [
        keras.callbacks.EarlyStopping(patience=4, restore_best_weights=True, monitor='val_accuracy'),
        keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=2, min_lr=1e-6),
        keras.callbacks.ModelCheckpoint('model_checkpoint.keras', save_best_only=True, monitor='val_accuracy'),
    ]

    model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=args.epochs,
        batch_size=args.batch,
        callbacks=callbacks,
        verbose=1
    )

    # ── Phase 2: Fine-tune top layers of base ─────────────────────────────────
    if args.fine_tune:
        print(f'\n── Phase 2: Fine-tuning base from layer {FINE_TUNE_AT} ──')
        base.trainable = True
        for layer in base.layers[:FINE_TUNE_AT]:
            layer.trainable = False

        model.compile(
            optimizer=keras.optimizers.Adam(1e-5),   # much lower LR for fine-tuning
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )

        model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=FINE_TUNE_EPOCHS,
            batch_size=args.batch,
            callbacks=callbacks,
            verbose=1
        )

    # ── Evaluate ──────────────────────────────────────────────────────────────
    val_loss, val_acc = model.evaluate(X_val, y_val, verbose=0)
    print(f'\nFinal val accuracy: {val_acc:.4f}  val loss: {val_loss:.4f}')

    # ── Export to TensorFlow.js ───────────────────────────────────────────────
    MODEL_OUT.mkdir(exist_ok=True)
    keras_path = str(MODEL_OUT / 'interior_model.keras')
    model.save(keras_path)
    print(f'Keras model saved to {keras_path}')

    # Convert to TF.js LayersModel format
    try:
        import tensorflowjs as tfjs
        tfjs_out = str(MODEL_OUT / 'tfjs')
        tfjs.converters.save_keras_model(model, tfjs_out)
        print(f'TF.js model saved to {tfjs_out}/')
        print('  → model.json + group1-shard*.bin')
    except ImportError:
        print('\nWARNING: tensorflowjs not installed. Run:')
        print('  pip install tensorflowjs')
        print('  tensorflowjs_converter --input_format keras model/interior_model.keras model/tfjs')

    # Save class index for use in ml.js
    class_index_path = MODEL_OUT / 'class_index.json'
    with open(class_index_path, 'w') as f:
        json.dump({'classes': CLASSES, 'classIndex': CLASS_INDEX}, f, indent=2)
    print(f'Class index saved to {class_index_path}')

    print('\n✓ Training complete. Next step: serve the app and open index.html')


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Train interior design style classifier')
    parser.add_argument('--epochs',    type=int,  default=EPOCHS,     help='Training epochs (phase 1)')
    parser.add_argument('--batch',     type=int,  default=BATCH_SIZE, help='Batch size')
    parser.add_argument('--fine-tune', action='store_true',           help='Run fine-tuning phase 2')
    args = parser.parse_args()
    train(args)
